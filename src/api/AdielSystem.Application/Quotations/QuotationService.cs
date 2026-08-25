using AdielSystem.Application.Common;
using AdielSystem.Application.Security;
using AdielSystem.Application.Settings;

namespace AdielSystem.Application.Quotations;

public sealed class QuotationService(IQuotationRepository repository, SettingsService settings, ICurrentUserAccessor currentUserAccessor)
{
    public Task<QuotationPageDto> ListAsync(string? search, string? status, bool archivedOnly, int page, int pageSize, CancellationToken token) => page <= 0 || pageSize is < 1 or > 100 ? throw new RequestValidationException("Page must be greater than zero and page size must be between 1 and 100.") : repository.ListAsync(search?.Trim() ?? string.Empty, string.IsNullOrWhiteSpace(status) ? null : status.Trim(), archivedOnly, page, pageSize, token);
    public async Task<QuotationDto> GetAsync(Guid id, CancellationToken token) => await repository.GetAsync(id, token) ?? throw new ResourceNotFoundException($"Quotation '{id}' was not found.");
    public async Task<QuotationDto> CreateAsync(SaveQuotationRequest request, CancellationToken token) { Validate(request); var number = (await settings.ReserveDocumentNumberAsync("quotation", new(request.QuotationDate), token)).Number; return await repository.CreateAsync(request, number, currentUserAccessor.GetRequiredUser(), token); }
    public async Task<QuotationDto> UpdateAsync(Guid id, SaveQuotationRequest request, CancellationToken token) { if (request.Version is null or <= 0) throw new RequestValidationException("The current quotation version is required."); Validate(request); return await repository.UpdateAsync(id, request, currentUserAccessor.GetRequiredUser(), token); }
    public Task<QuotationDto> ChangeStatusAsync(Guid id, ChangeQuotationStatusRequest request, CancellationToken token) => request.Version <= 0 ? throw new RequestValidationException("The current quotation version is required.") : repository.ChangeStatusAsync(id, request, currentUserAccessor.GetRequiredUser(), token);
    public Task<QuotationDto> ArchiveAsync(Guid id, ChangeQuotationArchiveRequest request, CancellationToken token) => repository.SetArchivedAsync(id, request, true, currentUserAccessor.GetRequiredUser(), token);
    public Task<QuotationDto> RestoreAsync(Guid id, ChangeQuotationArchiveRequest request, CancellationToken token) => repository.SetArchivedAsync(id, request, false, currentUserAccessor.GetRequiredUser(), token);
    private static void Validate(SaveQuotationRequest request) { if (request.QuotationDate == default || request.Lines is null || request.Charges is null || request.Lines.Any(line => string.IsNullOrWhiteSpace(line.ItemName) || string.IsNullOrWhiteSpace(line.UnitOfMeasure) || line.Quantity <= 0 || line.UnitPrice < 0 || line.UnitCost < 0) || request.Charges.Any(charge => string.IsNullOrWhiteSpace(charge.Label) || charge.Amount < 0)) throw new RequestValidationException("Quotation lines and charges are invalid."); if (request.Intent?.Equals("submit", StringComparison.OrdinalIgnoreCase) == true && (request.ClientId is null || request.ContactId is null || string.IsNullOrWhiteSpace(request.Subject) || string.IsNullOrWhiteSpace(request.ProjectLocation) || string.IsNullOrWhiteSpace(request.LeadTime) || request.Lines.Count == 0)) throw new RequestValidationException("Complete the client, contact, subject, project location, lead time, and lines before submitting for approval."); }
}
