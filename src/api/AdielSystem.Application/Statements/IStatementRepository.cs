using AdielSystem.Application.Security;

namespace AdielSystem.Application.Statements;

public interface IStatementRepository
{
    Task<StatementPageDto> ListAsync(string search, string? status, bool archivedOnly, int page, int pageSize, CancellationToken token);
    Task<StatementDto?> GetAsync(Guid id, CancellationToken token);
    Task<StatementDto> CreateAsync(SaveStatementRequest request, CurrentUser actor, CancellationToken token);
    Task<StatementDto> UpdateAsync(Guid id, SaveStatementRequest request, CurrentUser actor, CancellationToken token);
    Task<StatementDto> ChangeStatusAsync(Guid id, ChangeStatementStatusRequest request, CurrentUser actor, CancellationToken token);
    Task<StatementDto> SetArchivedAsync(Guid id, ChangeStatementArchiveRequest request, bool archived, CurrentUser actor, CancellationToken token);
    Task<StatementDto> ApplyLateChargeAsync(Guid id, Guid scheduleId, ApplyLateChargeRequest request, CurrentUser actor, CancellationToken token);
    Task<StatementDto> WaiveLateChargeAsync(Guid id, Guid scheduleId, WaiveLateChargeRequest request, CurrentUser actor, CancellationToken token);
    Task<StatementDto> RecordPaymentAsync(Guid id, RecordStatementPaymentRequest request, CurrentUser actor, CancellationToken token);
    Task<StatementDto> ReversePaymentAsync(Guid id, Guid paymentId, ReverseStatementPaymentRequest request, CurrentUser actor, CancellationToken token);
}
