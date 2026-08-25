using AdielSystem.Application.Common;
using AdielSystem.Application.Security;
using AdielSystem.Domain.Items;

namespace AdielSystem.Application.Items;

public sealed class ItemService(IItemRepository repository, ICurrentUserAccessor currentUserAccessor)
{
    private static readonly string[] SortValues = ["name", "newest", "price"];

    public async Task<ItemPageDto> ListAsync(string? search, Guid? supplierId, string? category, string? status, bool includeArchived, bool archivedOnly, int page, int pageSize, string? sort, CancellationToken cancellationToken)
    {
        if (includeArchived && archivedOnly) throw new RequestValidationException("Choose either all Items or archived Items, not both.");
        if (page <= 0 || pageSize is < 1 or > 100) throw new RequestValidationException("Page must be greater than zero and page size must be between 1 and 100.");
        var normalizedSort = string.IsNullOrWhiteSpace(sort) ? "newest" : sort.Trim().ToLowerInvariant();
        if (!SortValues.Contains(normalizedSort)) throw new RequestValidationException("Item sort must be name, newest, or price.");
        var criteria = new ItemSearchCriteria(search?.Trim() ?? string.Empty, supplierId?.ToString(), TrimOrNull(category), TrimOrNull(status), includeArchived, archivedOnly, page, pageSize, normalizedSort);
        var result = await repository.SearchAsync(criteria, cancellationToken);
        return new ItemPageDto(result.Items.Select(ToDto).ToArray(), page, pageSize, result.Total, new ItemDirectorySummaryDto(result.Summary.TotalItems, result.Summary.ActiveItems, result.Summary.CategoryCount, result.Summary.AverageMargin));
    }

    public async Task<ItemDto> GetAsync(Guid id, CancellationToken cancellationToken) => ToDto(await GetRequiredAsync(id, cancellationToken));

    public async Task<ItemDto> CreateAsync(SaveItemRequest request, CancellationToken cancellationToken)
    {
        var item = CreateItem(request);
        await RequireActiveCategoryAsync(item.Category, cancellationToken);
        return ToDto(await repository.CreateAsync(item, currentUserAccessor.GetRequiredUser(), cancellationToken));
    }

    public async Task<ItemDto> UpdateAsync(Guid id, SaveItemRequest request, CancellationToken cancellationToken)
    {
        if (request.Version is null or <= 0) throw new RequestValidationException("The current item version is required when saving changes.");
        var existing = await GetRequiredAsync(id, cancellationToken);
        var item = CreateItem(request, existing);
        await RequireActiveCategoryAsync(item.Category, cancellationToken);
        return ToDto(await repository.UpdateAsync(item, request.Version.Value, currentUserAccessor.GetRequiredUser(), cancellationToken));
    }

    public async Task<ItemDto> ArchiveAsync(Guid id, long version, CancellationToken cancellationToken) => ToDto(await SetArchivedAsync(id, version, true, cancellationToken));
    public async Task<ItemDto> RestoreAsync(Guid id, long version, CancellationToken cancellationToken) => ToDto(await SetArchivedAsync(id, version, false, cancellationToken));

    public async Task<ItemDto> CreateVariantAsync(Guid itemId, SaveItemVariantRequest request, CancellationToken cancellationToken)
    {
        await EnsureActiveAsync(itemId, cancellationToken); ValidateVariant(request);
        return ToDto(await repository.CreateVariantAsync(itemId, request, currentUserAccessor.GetRequiredUser(), cancellationToken));
    }

    public async Task<ItemDto> UpdateVariantAsync(Guid itemId, Guid variantId, SaveItemVariantRequest request, CancellationToken cancellationToken)
    {
        await EnsureActiveAsync(itemId, cancellationToken);
        if (request.Version is null or <= 0) throw new RequestValidationException("The current variant version is required when saving changes.");
        ValidateVariant(request);
        return ToDto(await repository.UpdateVariantAsync(itemId, variantId, request, currentUserAccessor.GetRequiredUser(), cancellationToken));
    }

    public async Task<ItemDto> DeleteVariantAsync(Guid itemId, Guid variantId, long version, CancellationToken cancellationToken)
    {
        await EnsureActiveAsync(itemId, cancellationToken);
        if (version <= 0) throw new RequestValidationException("The current variant version is required.");
        return ToDto(await repository.DeleteVariantAsync(itemId, variantId, version, currentUserAccessor.GetRequiredUser(), cancellationToken));
    }

    public async Task<ItemDto> AddPriceAdjustmentAsync(Guid itemId, AddPriceAdjustmentRequest request, CancellationToken cancellationToken)
    {
        await EnsureActiveAsync(itemId, cancellationToken);
        if (request.ItemVersion <= 0 || request.VariantId is not null && (request.VariantVersion is null or <= 0)) throw new RequestValidationException("The current item and variant versions are required.");
        if (request.RawCost < 0 || request.SellingPrice < 0 || request.EffectiveDate > DateOnly.FromDateTime(DateTime.UtcNow) || string.IsNullOrWhiteSpace(request.Reason)) throw new RequestValidationException("Enter valid prices, an effective date, and an adjustment reason.");
        return ToDto(await repository.AddPriceAdjustmentAsync(itemId, request with { Reason = request.Reason.Trim(), Notes = request.Notes?.Trim() ?? string.Empty }, currentUserAccessor.GetRequiredUser(), cancellationToken));
    }

    private async Task<Item> SetArchivedAsync(Guid id, long version, bool archived, CancellationToken cancellationToken)
    {
        if (version <= 0) throw new RequestValidationException("The current item version is required.");
        var item = await GetRequiredAsync(id, cancellationToken);
        if (archived) item.Archive(DateTimeOffset.UtcNow); else item.Restore();
        return await repository.SetArchivedAsync(item, version, archived, currentUserAccessor.GetRequiredUser(), cancellationToken);
    }
    private async Task<Item> GetRequiredAsync(Guid id, CancellationToken cancellationToken) => await repository.GetAsync(id, cancellationToken) ?? throw new ResourceNotFoundException($"Item '{id}' was not found.");
    private async Task EnsureActiveAsync(Guid id, CancellationToken token) { var item = await GetRequiredAsync(id, token); if (item.ArchivedAt is not null) throw new RequestValidationException("Restore the item before changing it."); }
    private async Task RequireActiveCategoryAsync(string category, CancellationToken token) { if (!await repository.AreActiveCategoriesAsync([category], token)) throw new RequestValidationException("Choose an active Item category from Settings."); }
    private static Item CreateItem(SaveItemRequest request, Item? existing = null) { try { return existing is null ? Item.Create(Guid.NewGuid(), request.SupplierId, request.Name, request.Photo, request.Category, request.Subcategory ?? string.Empty, request.Brand ?? string.Empty, request.UnitOfMeasure, request.UnitWeight, request.ProductCode, request.Barcode, request.Description, ParseStatus(request.Status), request.RawCost, request.SellingPrice, request.LastPriceUpdate) : Item.Rehydrate(existing.Id, request.SupplierId, request.Name, request.Photo, request.Category, request.Subcategory ?? string.Empty, request.Brand ?? string.Empty, request.UnitOfMeasure, request.UnitWeight, request.ProductCode, request.Barcode, request.Description, ParseStatus(request.Status), request.RawCost, request.SellingPrice, request.LastPriceUpdate, existing.Variants, existing.PriceAdjustments, existing.CreatedAt, existing.UpdatedAt, existing.ArchivedAt, existing.Version); } catch (ArgumentException ex) { throw new RequestValidationException(ex.Message); } }
    private static void ValidateVariant(SaveItemVariantRequest request) { if (string.IsNullOrWhiteSpace(request.Name) || request.Name.Trim().Length > 100 || string.IsNullOrWhiteSpace(request.Value) || request.Value.Trim().Length > 200 || string.IsNullOrWhiteSpace(request.UnitOfMeasure) || request.UnitOfMeasure.Trim().Length > 60 || request.UnitWeight < 0 || request.RawCost < 0 || request.SellingPrice < 0 || request.Specifications.Any(spec => string.IsNullOrWhiteSpace(spec.Name) || spec.Name.Trim().Length > 100 || string.IsNullOrWhiteSpace(spec.Value) || spec.Value.Trim().Length > 500)) throw new RequestValidationException("Complete valid variant details, specifications, and non-negative prices."); if (!string.IsNullOrWhiteSpace(request.Photo) && request.Photo.Trim().StartsWith("data:", StringComparison.OrdinalIgnoreCase)) throw new RequestValidationException("Variant photos must be uploaded to private storage."); }
    private static ItemStatus ParseStatus(string value) => value.Trim() switch { "Active" => ItemStatus.Active, "Inactive" => ItemStatus.Inactive, "Discontinued" => ItemStatus.Discontinued, _ => throw new RequestValidationException("Item status is invalid.") };
    private static string? TrimOrNull(string? value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim();
    private static ItemDto ToDto(Item item) => new(item.Id, item.SupplierId, item.Name, item.PhotoPath ?? string.Empty, item.Category, item.Subcategory, item.Brand, item.UnitOfMeasure, item.UnitWeight, item.ProductCode, item.Barcode, item.Description, item.Status.ToString(), item.RawCost, item.SellingPrice, item.LastPriceUpdate, item.Variants.Select(variant => new ItemVariantDto(variant.Id, variant.Name, variant.Value, variant.PhotoPath ?? string.Empty, variant.ProductCode, variant.Barcode, variant.UnitOfMeasure, variant.UnitWeight, variant.Status.ToString(), variant.RawCost, variant.SellingPrice, variant.SortOrder, variant.Specifications.Select(spec => new ItemVariantSpecificationDto(spec.Id, spec.Name, spec.Value, spec.SortOrder)).ToArray(), variant.CreatedAt, variant.UpdatedAt, variant.Version)).ToArray(), item.PriceAdjustments.Select(adjustment => new ItemPriceAdjustmentDto(adjustment.Id, adjustment.VariantId, adjustment.EffectiveDate, adjustment.PreviousRawCost, adjustment.PreviousSellingPrice, adjustment.RawCost, adjustment.SellingPrice, adjustment.Reason, adjustment.Notes, adjustment.CreatedAt, adjustment.CreatedBy)).ToArray(), item.CreatedAt, item.UpdatedAt, item.ArchivedAt, item.Version);
}
