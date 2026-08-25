using AdielSystem.Application.Security;

namespace AdielSystem.Application.Quotations;

public interface IQuotationRepository
{
    Task<QuotationPageDto> ListAsync(string search, string? status, bool archivedOnly, int page, int pageSize, CancellationToken cancellationToken);
    Task<QuotationDto?> GetAsync(Guid id, CancellationToken cancellationToken);
    Task<QuotationDto> CreateAsync(SaveQuotationRequest request, string quotationNumber, CurrentUser actor, CancellationToken cancellationToken);
    Task<QuotationDto> UpdateAsync(Guid id, SaveQuotationRequest request, CurrentUser actor, CancellationToken cancellationToken);
    Task<QuotationDto> ChangeStatusAsync(Guid id, ChangeQuotationStatusRequest request, CurrentUser actor, CancellationToken cancellationToken);
    Task<QuotationDto> SetArchivedAsync(Guid id, ChangeQuotationArchiveRequest request, bool archived, CurrentUser actor, CancellationToken cancellationToken);
}
