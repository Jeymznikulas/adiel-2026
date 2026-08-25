using AdielSystem.Application.Common;
using AdielSystem.Application.Security;
using AdielSystem.Domain.Suppliers;

namespace AdielSystem.Application.Suppliers;

public sealed class SupplierService(ISupplierRepository repository, ICurrentUserAccessor currentUserAccessor)
{
    private static readonly string[] SortValues = ["name", "newest", "type"];

    public async Task<SupplierPageDto> ListAsync(string? search, string? type, bool includeArchived, bool archivedOnly, int page, int pageSize, string? sort, CancellationToken cancellationToken)
    {
        if (includeArchived && archivedOnly) throw new RequestValidationException("Choose either all Suppliers or archived Suppliers, not both.");
        if (page <= 0) throw new RequestValidationException("Page must be greater than zero.");
        if (pageSize is < 1 or > 100) throw new RequestValidationException("Page size must be between 1 and 100.");
        var normalizedSort = string.IsNullOrWhiteSpace(sort) ? "name" : sort.Trim().ToLowerInvariant();
        if (!SortValues.Contains(normalizedSort)) throw new RequestValidationException("Supplier sort must be name, newest, or type.");
        var criteria = new SupplierSearchCriteria(search?.Trim() ?? string.Empty, string.IsNullOrWhiteSpace(type) ? null : ToDisplayValue(ParseType(type)), includeArchived, archivedOnly, page, pageSize, normalizedSort);
        var result = await repository.SearchAsync(criteria, cancellationToken);
        return new SupplierPageDto(result.Items.Select(ToDto).ToArray(), page, pageSize, result.Total, new SupplierDirectorySummaryDto(result.Summary.TotalSuppliers, result.Summary.ActiveSuppliers, result.Summary.CategoryCount));
    }

    public async Task<SupplierDto> GetAsync(Guid id, CancellationToken cancellationToken) => ToDto(await GetRequiredAsync(id, cancellationToken));

    public async Task<SupplierDto> CreateAsync(SaveSupplierRequest request, CancellationToken cancellationToken)
    {
        var supplier = CreateSupplier(request);
        await RequireActiveCategoriesAsync(supplier.Categories, cancellationToken);
        return ToDto(await repository.CreateAsync(supplier, currentUserAccessor.GetRequiredUser(), cancellationToken));
    }

    public async Task<SupplierDto> UpdateAsync(Guid id, SaveSupplierRequest request, CancellationToken cancellationToken)
    {
        if (request.Version is null or <= 0) throw new RequestValidationException("The current supplier version is required when saving changes.");
        var supplier = await GetRequiredAsync(id, cancellationToken);
        var updated = CreateSupplier(request, supplier);
        await RequireActiveCategoriesAsync(updated.Categories, cancellationToken);
        return ToDto(await repository.UpdateAsync(updated, request.Version.Value, currentUserAccessor.GetRequiredUser(), cancellationToken));
    }

    public async Task<SupplierDto> ArchiveAsync(Guid id, long version, CancellationToken cancellationToken)
    {
        if (version <= 0) throw new RequestValidationException("The current supplier version is required.");
        var supplier = await GetRequiredAsync(id, cancellationToken);
        supplier.Archive(DateTimeOffset.UtcNow);
        return ToDto(await repository.SetArchivedAsync(supplier, version, true, currentUserAccessor.GetRequiredUser(), cancellationToken));
    }

    public async Task<SupplierDto> RestoreAsync(Guid id, long version, CancellationToken cancellationToken)
    {
        if (version <= 0) throw new RequestValidationException("The current supplier version is required.");
        var supplier = await GetRequiredAsync(id, cancellationToken);
        supplier.Restore();
        return ToDto(await repository.SetArchivedAsync(supplier, version, false, currentUserAccessor.GetRequiredUser(), cancellationToken));
    }

    private async Task<Supplier> GetRequiredAsync(Guid id, CancellationToken cancellationToken) => await repository.GetAsync(id, cancellationToken) ?? throw new ResourceNotFoundException($"Supplier '{id}' was not found.");
    private async Task RequireActiveCategoriesAsync(IReadOnlyList<string> categories, CancellationToken cancellationToken) { if (categories.Count > 0 && !await repository.AreActiveCategoriesAsync(categories, cancellationToken)) throw new RequestValidationException("Choose active Supplier categories from Settings."); }
    private static Supplier CreateSupplier(SaveSupplierRequest request, Supplier? existing = null)
    {
        try
        {
            var contacts = CreateContacts(request.Contacts);
            var notes = CreateNotes(request.PerformanceNotes);
            return existing is null
                ? Supplier.Create(Guid.NewGuid(), request.Name, request.Logo, ParseType(request.Type), ParseStatus(request.Status), request.Tin, request.CompanyEmail, request.CompanyPhone, request.Address, request.CatalogUrl, contacts, request.Categories ?? [], notes)
                : Supplier.Rehydrate(existing.Id, request.Name, request.Logo, ParseType(request.Type), ParseStatus(request.Status), request.Tin, request.CompanyEmail, request.CompanyPhone, request.Address, request.CatalogUrl, contacts, request.Categories ?? [], notes, existing.CreatedAt, existing.UpdatedAt, existing.ArchivedAt, existing.Version);
        }
        catch (ArgumentException exception) { throw new RequestValidationException(exception.Message); }
    }
    private static IReadOnlyList<SupplierContact> CreateContacts(IReadOnlyList<SupplierContactRequest>? contacts) { if (contacts is null || contacts.Count == 0) throw new RequestValidationException("At least one contact person is required."); return contacts.Select((contact, index) => SupplierContact.Create(contact.Id is null || contact.Id == Guid.Empty ? Guid.NewGuid() : contact.Id.Value, contact.Name, contact.Email, contact.Phone, index == 0, index)).ToArray(); }
    private static IReadOnlyList<SupplierPerformanceNote> CreateNotes(IReadOnlyList<SupplierPerformanceNoteRequest>? notes) => (notes ?? []).Where(note => !string.IsNullOrWhiteSpace(note.Text)).Select(note => SupplierPerformanceNote.Create(note.Id ?? Guid.NewGuid(), note.Text)).ToArray();
    private static SupplierType ParseType(string value) => value.Trim() switch { "Contractor" => SupplierType.Contractor, "Distributor" => SupplierType.Distributor, "Manufacturer" => SupplierType.Manufacturer, "Service provider" => SupplierType.ServiceProvider, "Other" => SupplierType.Other, _ => throw new RequestValidationException("Supplier type is invalid.") };
    private static SupplierStatus ParseStatus(string value) => value.Trim() switch { "Active" => SupplierStatus.Active, "Inactive" => SupplierStatus.Inactive, _ => throw new RequestValidationException("Supplier status must be Active or Inactive.") };
    private static string ToDisplayValue(SupplierType value) => value switch { SupplierType.ServiceProvider => "Service provider", _ => value.ToString() };
    private static SupplierDto ToDto(Supplier supplier) => new(supplier.Id, supplier.LogoPath ?? string.Empty, supplier.Name, ToDisplayValue(supplier.Type), supplier.Status.ToString(), supplier.Tin, supplier.CompanyEmail, supplier.CompanyPhone, supplier.Address, supplier.CatalogUrl ?? string.Empty, supplier.Contacts.Select(contact => new SupplierContactDto(contact.Id, contact.Name, contact.Email, contact.Phone, contact.IsPrimary, contact.SortOrder)).ToArray(), supplier.Categories, supplier.PerformanceNotes.Select(note => new SupplierPerformanceNoteDto(note.Id, note.Text)).ToArray(), supplier.CreatedAt, supplier.UpdatedAt, supplier.ArchivedAt, supplier.Version);
}
