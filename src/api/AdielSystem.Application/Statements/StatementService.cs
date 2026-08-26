using AdielSystem.Application.Common;
using AdielSystem.Application.Security;

namespace AdielSystem.Application.Statements;

public sealed class StatementService(IStatementRepository repository, ICurrentUserAccessor currentUser)
{
    private static readonly HashSet<string> Arrangements = ["Full payment", "Installment", "Custom schedule"];
    private static readonly HashSet<string> Frequencies = ["Weekly", "Every 2 weeks", "Monthly", "Quarterly", "Custom"];
    private static readonly HashSet<string> LateChargeTypes = ["Percentage", "Fixed amount"];

    public Task<StatementPageDto> ListAsync(string? search, string? status, bool archivedOnly, int page, int pageSize, CancellationToken token) => page <= 0 || pageSize is < 1 or > 100 ? throw new RequestValidationException("Page must be greater than zero and page size must be between 1 and 100.") : repository.ListAsync(search?.Trim() ?? string.Empty, string.IsNullOrWhiteSpace(status) ? null : status.Trim(), archivedOnly, page, pageSize, token);
    public async Task<StatementDto> GetAsync(Guid id, CancellationToken token) => await repository.GetAsync(id, token) ?? throw new ResourceNotFoundException($"Statement '{id}' was not found.");
    public Task<StatementDto> CreateAsync(SaveStatementRequest request, CancellationToken token) { Validate(request); return repository.CreateAsync(request, currentUser.GetRequiredUser(), token); }
    public Task<StatementDto> UpdateAsync(Guid id, SaveStatementRequest request, CancellationToken token) { RequireVersion(request.Version); Validate(request); return repository.UpdateAsync(id, request, currentUser.GetRequiredUser(), token); }
    public Task<StatementDto> ChangeStatusAsync(Guid id, ChangeStatementStatusRequest request, CancellationToken token) => request.Version <= 0 ? throw new RequestValidationException("The current statement version is required.") : repository.ChangeStatusAsync(id, request, currentUser.GetRequiredUser(), token);
    public Task<StatementDto> ArchiveAsync(Guid id, ChangeStatementArchiveRequest request, CancellationToken token) => request.Version <= 0 ? throw new RequestValidationException("The current statement version is required.") : repository.SetArchivedAsync(id, request, true, currentUser.GetRequiredUser(), token);
    public Task<StatementDto> RestoreAsync(Guid id, ChangeStatementArchiveRequest request, CancellationToken token) => request.Version <= 0 ? throw new RequestValidationException("The current statement version is required.") : repository.SetArchivedAsync(id, request, false, currentUser.GetRequiredUser(), token);
    public Task<StatementDto> ApplyLateChargeAsync(Guid id, Guid scheduleId, ApplyLateChargeRequest request, CancellationToken token) => request.Version <= 0 ? throw new RequestValidationException("The current statement version is required.") : repository.ApplyLateChargeAsync(id, scheduleId, request, currentUser.GetRequiredUser(), token);
    public Task<StatementDto> WaiveLateChargeAsync(Guid id, Guid scheduleId, WaiveLateChargeRequest request, CancellationToken token) => request.Version <= 0 || string.IsNullOrWhiteSpace(request.Reason) ? throw new RequestValidationException("A waiver reason and the current statement version are required.") : repository.WaiveLateChargeAsync(id, scheduleId, request, currentUser.GetRequiredUser(), token);
    public Task<StatementDto> RecordPaymentAsync(Guid id, RecordStatementPaymentRequest request, CancellationToken token)
    {
        if (request.Version <= 0 || request.PaymentDate == default || request.Amount <= 0 || string.IsNullOrWhiteSpace(request.Method) || string.IsNullOrWhiteSpace(request.IdempotencyKey) || request.IdempotencyKey.Trim().Length > 100) throw new RequestValidationException("Payment date, amount, method, idempotency key and current statement version are required.");
        return repository.RecordPaymentAsync(id, request, currentUser.GetRequiredUser(), token);
    }
    public Task<StatementDto> ReversePaymentAsync(Guid id, Guid paymentId, ReverseStatementPaymentRequest request, CancellationToken token) => request.Version <= 0 || request.ReversalDate == default || string.IsNullOrWhiteSpace(request.Reason) ? throw new RequestValidationException("Reversal date, reason and current statement version are required.") : repository.ReversePaymentAsync(id, paymentId, request, currentUser.GetRequiredUser(), token);

    private static void Validate(SaveStatementRequest request)
    {
        if (request.StatementDate == default || request.CoverageFrom == default || request.CoverageTo == default || request.DueDate == default || request.CoverageFrom > request.CoverageTo || request.ClientId == Guid.Empty || request.OpeningBalance < 0 || request.QuotationIds is null || request.QuotationIds.Count == 0 || request.QuotationIds.Distinct().Count() != request.QuotationIds.Count || request.PaymentSchedule is null)
            throw new RequestValidationException("Statement dates, client, opening balance, quotation links and payment schedule are invalid.");
        if (!Arrangements.Contains(request.PaymentArrangement) || !Frequencies.Contains(request.PaymentFrequency) || !LateChargeTypes.Contains(request.LateChargeType) || request.LateChargeGraceDays is < 0 or > 90 || request.LateChargeValue < 0)
            throw new RequestValidationException("Payment arrangement or late-charge policy is invalid.");
        if (request.Intent is not null && !request.Intent.Equals("draft", StringComparison.OrdinalIgnoreCase) && !request.Intent.Equals("issue", StringComparison.OrdinalIgnoreCase) && !request.Intent.Equals("preserve", StringComparison.OrdinalIgnoreCase))
            throw new RequestValidationException("Statement intent is invalid.");
        if (request.PaymentSchedule.Any(entry => string.IsNullOrWhiteSpace(entry.Label) || entry.DueDate == default || entry.Amount <= 0 || entry.LateChargeGraceDays is < 0 or > 90 || entry.LateChargeValue < 0 || entry.LateChargeType is not null && !LateChargeTypes.Contains(entry.LateChargeType)))
            throw new RequestValidationException("Payment schedule entries are invalid.");
    }

    private static void RequireVersion(long? version) { if (version is null or <= 0) throw new RequestValidationException("The current statement version is required."); }
}
