using System.Transactions;
using AdielSystem.Application.Common;
using AdielSystem.Application.Security;
using AdielSystem.Application.Statements;
using Npgsql;

namespace AdielSystem.Infrastructure.Statements;

public sealed class StatementRepository(NpgsqlDataSource dataSource) : IStatementRepository
{
    public async Task<StatementPageDto> ListAsync(string search, string? status, bool archivedOnly, int page, int pageSize, CancellationToken token)
    {
        await using var connection = await dataSource.OpenConnectionAsync(token);
        const string where = "deleted_at is null and (@archived_only = (archived_at is not null)) and (@status='' or status=@status) and (@search='' or soa_number ilike @search or client_name ilike @search or contact_person ilike @search)";
        var ids = new List<Guid>();
        await using (var command = connection.CreateCommand())
        {
            command.CommandText = $"select id from public.statements_of_account where {where} order by statement_date desc,created_at desc limit @limit offset @offset";
            AddListParameters(command, search, status, archivedOnly, page, pageSize);
            await using var reader = await command.ExecuteReaderAsync(token);
            while (await reader.ReadAsync(token)) ids.Add(reader.GetGuid(0));
        }
        var items = new List<StatementDto>();
        foreach (var id in ids) items.Add(await RequiredAsync(connection, null, id, token));
        await using var count = connection.CreateCommand(); count.CommandText = $"select count(*) from public.statements_of_account where {where}"; AddListParameters(count, search, status, archivedOnly, page, pageSize);
        return new(items, page, pageSize, (long)(await count.ExecuteScalarAsync(token) ?? 0L));
    }

    public async Task<StatementDto?> GetAsync(Guid id, CancellationToken token) { await using var connection = await dataSource.OpenConnectionAsync(token); return await ReadAsync(connection, null, id, token); }

    public Task<StatementDto> CreateAsync(SaveStatementRequest request, CurrentUser actor, CancellationToken token) => ExecuteAsync(async (connection, transaction) =>
    {
        var resolved = await ResolveAsync(connection, transaction, request, null, token);
        var number = await ReserveNumberAsync(connection, transaction, request.StatementDate, token);
        var id = Guid.NewGuid();
        await InsertHeaderAsync(connection, transaction, id, number, request, resolved, actor, token);
        await ReplaceChildrenAsync(connection, transaction, id, resolved, token);
        await InsertAuditAsync(connection, transaction, id, "Created", number, $"Statement created for {resolved.ClientName}.", resolved.Status, resolved.Balance, actor, token);
        return await RequiredAsync(connection, transaction, id, token);
    }, token);

    public Task<StatementDto> UpdateAsync(Guid id, SaveStatementRequest request, CurrentUser actor, CancellationToken token) => ExecuteAsync(async (connection, transaction) =>
    {
        var existing = await RequiredAsync(connection, transaction, id, token);
        if (existing.Status != "Draft") throw new ResourceConflictException("Only draft statements can be edited.");
        var resolved = await ResolveAsync(connection, transaction, request, id, token);
        await using (var command = connection.CreateCommand())
        {
            command.Transaction = transaction;
            command.CommandText = """
                update public.statements_of_account set statement_date=@statement_date,coverage_from=@coverage_from,coverage_to=@coverage_to,due_date=@due_date,
                client_id=@client_id,client_name=@client_name,contact_person=@contact_person,opening_balance=@opening_balance,total_charges=@total_charges,
                total_payments=0,balance=@balance,payment_arrangement=@arrangement,payment_frequency=@frequency,late_charge_enabled=@late_enabled,
                late_charge_grace_days=@grace_days,late_charge_type=@late_type,late_charge_value=@late_value,status=@status,notes=@notes,terms=@terms,
                issued_at=case when @status='Issued' then now() else null end,issued_by=case when @status='Issued' then @actor else null end,updated_by=@actor
                where id=@id and status='Draft' and archived_at is null and deleted_at is null and version=@version returning id
                """;
            AddHeaderParameters(command, id, request, resolved, actor.Id); command.Parameters.AddWithValue("version", request.Version!.Value);
            if (await command.ExecuteScalarAsync(token) is null) throw Stale();
        }
        await ReplaceChildrenAsync(connection, transaction, id, resolved, token);
        await InsertAuditAsync(connection, transaction, id, "Updated", existing.SoaNumber, "Statement details, quotation snapshots and schedule were updated.", resolved.Status, resolved.Balance, actor, token);
        return await RequiredAsync(connection, transaction, id, token);
    }, token);

    public Task<StatementDto> ChangeStatusAsync(Guid id, ChangeStatementStatusRequest request, CurrentUser actor, CancellationToken token) => ExecuteAsync(async (connection, transaction) =>
    {
        var existing = await RequiredAsync(connection, transaction, id, token); var target = request.Status.Trim(); ValidateTransition(existing.Status, target, request.Reason);
        await using var command = connection.CreateCommand(); command.Transaction = transaction;
        command.CommandText = """
            update public.statements_of_account set status=@status,
            issued_at=case when @status='Issued' then now() else issued_at end,issued_by=case when @status='Issued' then @actor else issued_by end,
            voided_at=case when @status='Cancelled' then now() else voided_at end,voided_by=case when @status='Cancelled' then @actor else voided_by end,
            void_reason=case when @status='Cancelled' then @reason else void_reason end,
            archived_at=case when @archive_after then now() else archived_at end,archived_by=case when @archive_after then @actor else archived_by end,updated_by=@actor
            where id=@id and archived_at is null and deleted_at is null and version=@version returning id
            """;
        command.Parameters.AddWithValue("status", target); command.Parameters.AddWithValue("reason", request.Reason?.Trim() ?? string.Empty); command.Parameters.AddWithValue("archive_after", target == "Cancelled" && request.ArchiveAfterVoiding); command.Parameters.AddWithValue("actor", actor.Id); command.Parameters.AddWithValue("id", id); command.Parameters.AddWithValue("version", request.Version);
        if (await command.ExecuteScalarAsync(token) is null) throw Stale();
        await InsertAuditAsync(connection, transaction, id, target == "Cancelled" ? "Voided" : "Status changed", existing.SoaNumber, target == "Cancelled" ? $"Statement voided: {request.Reason?.Trim()}" : $"Statement status changed from {existing.Status} to {target}.", target, existing.Balance, actor, token);
        return await RequiredAsync(connection, transaction, id, token);
    }, token);

    public Task<StatementDto> SetArchivedAsync(Guid id, ChangeStatementArchiveRequest request, bool archived, CurrentUser actor, CancellationToken token) => ExecuteAsync(async (connection, transaction) =>
    {
        var existing = await RequiredAsync(connection, transaction, id, token);
        await using var command = connection.CreateCommand(); command.Transaction = transaction;
        command.CommandText = archived ? "update public.statements_of_account set archived_at=now(),archived_by=@actor,updated_by=@actor where id=@id and archived_at is null and deleted_at is null and version=@version returning id" : "update public.statements_of_account set archived_at=null,archived_by=null,updated_by=@actor where id=@id and archived_at is not null and deleted_at is null and version=@version returning id";
        command.Parameters.AddWithValue("actor", actor.Id); command.Parameters.AddWithValue("id", id); command.Parameters.AddWithValue("version", request.Version);
        if (await command.ExecuteScalarAsync(token) is null) throw Stale();
        await InsertAuditAsync(connection, transaction, id, archived ? "Archived" : "Restored", existing.SoaNumber, archived ? "Statement archived with snapshots and schedules retained." : "Statement restored.", existing.Status, existing.Balance, actor, token);
        return await RequiredAsync(connection, transaction, id, token);
    }, token);

    public Task<StatementDto> ApplyLateChargeAsync(Guid id, Guid scheduleId, ApplyLateChargeRequest request, CurrentUser actor, CancellationToken token) => ExecuteAsync(async (connection, transaction) =>
    {
        var statement = await RequiredAsync(connection, transaction, id, token);
        if (statement.Version != request.Version) throw Stale();
        if (statement.Status is "Draft" or "Cancelled") throw new ResourceConflictException("Late charges require an active issued statement.");
        var schedule = statement.PaymentSchedule.SingleOrDefault(entry => entry.Id == scheduleId) ?? throw new RequestValidationException("Schedule entry was not found.");
        if (statement.LateCharges.Any(charge => charge.ScheduleId == scheduleId)) throw new ResourceConflictException("A late charge has already been reviewed for this schedule entry.");
        var enabled = schedule.LateChargeEnabled ?? statement.LateChargeEnabled; var grace = schedule.LateChargeGraceDays ?? statement.LateChargeGraceDays; var type = schedule.LateChargeType ?? statement.LateChargeType; var value = schedule.LateChargeValue ?? statement.LateChargeValue;
        var appliedDate = DateOnly.FromDateTime(DateTime.UtcNow);
        if (!enabled || value <= 0 || appliedDate <= schedule.DueDate.AddDays(grace)) throw new RequestValidationException("This schedule entry is not eligible for a late charge.");
        var calculated = decimal.Round(type == "Percentage" ? schedule.Amount * value / 100m : value, 2, MidpointRounding.AwayFromZero);
        await using (var insert = connection.CreateCommand())
        {
            insert.Transaction = transaction; insert.CommandText = "insert into public.statement_late_charges(statement_id,payment_schedule_id,applied_date,charge_type,rate_value,calculated_amount,amount,created_by,updated_by) values(@statement,@schedule,@date,@type,@value,@amount,@amount,@actor,@actor)";
            insert.Parameters.AddWithValue("statement", id); insert.Parameters.AddWithValue("schedule", scheduleId); insert.Parameters.AddWithValue("date", appliedDate); insert.Parameters.AddWithValue("type", type); insert.Parameters.AddWithValue("value", value); insert.Parameters.AddWithValue("amount", calculated); insert.Parameters.AddWithValue("actor", actor.Id); await insert.ExecuteNonQueryAsync(token);
        }
        await using (var update = connection.CreateCommand())
        {
            update.Transaction = transaction; update.CommandText = "update public.statements_of_account set balance=balance+@amount,updated_by=@actor where id=@id and version=@version returning id"; update.Parameters.AddWithValue("amount", calculated); update.Parameters.AddWithValue("actor", actor.Id); update.Parameters.AddWithValue("id", id); update.Parameters.AddWithValue("version", request.Version); if (await update.ExecuteScalarAsync(token) is null) throw Stale();
        }
        await InsertAuditAsync(connection, transaction, id, "Updated", statement.SoaNumber, $"Backend-calculated late charge applied to {schedule.Label}.", statement.Status, calculated, actor, token);
        return await RequiredAsync(connection, transaction, id, token);
    }, token);

    public Task<StatementDto> WaiveLateChargeAsync(Guid id, Guid scheduleId, WaiveLateChargeRequest request, CurrentUser actor, CancellationToken token) => ExecuteAsync(async (connection, transaction) =>
    {
        var statement = await RequiredAsync(connection, transaction, id, token);
        if (statement.Version != request.Version) throw Stale();
        if (statement.Status is "Draft" or "Cancelled") throw new ResourceConflictException("Late-charge review requires an active issued statement.");
        var schedule = statement.PaymentSchedule.SingleOrDefault(entry => entry.Id == scheduleId) ?? throw new RequestValidationException("Schedule entry was not found.");
        var existing = statement.LateCharges.SingleOrDefault(charge => charge.ScheduleId == scheduleId);
        var enabled = schedule.LateChargeEnabled ?? statement.LateChargeEnabled; var grace = schedule.LateChargeGraceDays ?? statement.LateChargeGraceDays; var type = schedule.LateChargeType ?? statement.LateChargeType; var value = schedule.LateChargeValue ?? statement.LateChargeValue; var appliedDate = DateOnly.FromDateTime(DateTime.UtcNow);
        if (!enabled || value <= 0 || appliedDate <= schedule.DueDate.AddDays(grace)) throw new RequestValidationException("This schedule entry is not eligible for late-charge review.");
        var calculated = decimal.Round(type == "Percentage" ? schedule.Amount * value / 100m : value, 2, MidpointRounding.AwayFromZero);
        if (existing is null)
        {
            await using var insert = connection.CreateCommand(); insert.Transaction = transaction; insert.CommandText = "insert into public.statement_late_charges(statement_id,payment_schedule_id,applied_date,charge_type,rate_value,calculated_amount,amount,status,reason,created_by,updated_by) values(@statement,@schedule,@date,@type,@value,@amount,@amount,'Waived',@reason,@actor,@actor)"; insert.Parameters.AddWithValue("statement", id); insert.Parameters.AddWithValue("schedule", scheduleId); insert.Parameters.AddWithValue("date", appliedDate); insert.Parameters.AddWithValue("type", type); insert.Parameters.AddWithValue("value", value); insert.Parameters.AddWithValue("amount", calculated); insert.Parameters.AddWithValue("reason", request.Reason.Trim()); insert.Parameters.AddWithValue("actor", actor.Id); await insert.ExecuteNonQueryAsync(token);
        }
        else
        {
            if (existing.Status == "Waived") throw new ResourceConflictException("This late charge is already waived.");
            await using (var updateCharge = connection.CreateCommand()) { updateCharge.Transaction = transaction; updateCharge.CommandText = "update public.statement_late_charges set status='Waived',reason=@reason,updated_by=@actor where id=@id and version=@version returning id"; updateCharge.Parameters.AddWithValue("reason", request.Reason.Trim()); updateCharge.Parameters.AddWithValue("actor", actor.Id); updateCharge.Parameters.AddWithValue("id", existing.Id); updateCharge.Parameters.AddWithValue("version", existing.Version); if (await updateCharge.ExecuteScalarAsync(token) is null) throw Stale(); }
            await using var balance = connection.CreateCommand(); balance.Transaction = transaction; balance.CommandText = "update public.statements_of_account set balance=greatest(0,balance-@amount),updated_by=@actor where id=@id and version=@version returning id"; balance.Parameters.AddWithValue("amount", existing.Amount); balance.Parameters.AddWithValue("actor", actor.Id); balance.Parameters.AddWithValue("id", id); balance.Parameters.AddWithValue("version", request.Version); if (await balance.ExecuteScalarAsync(token) is null) throw Stale();
        }
        if (existing is null) { await using var touch = connection.CreateCommand(); touch.Transaction = transaction; touch.CommandText = "update public.statements_of_account set updated_by=@actor where id=@id and version=@version returning id"; touch.Parameters.AddWithValue("actor", actor.Id); touch.Parameters.AddWithValue("id", id); touch.Parameters.AddWithValue("version", request.Version); if (await touch.ExecuteScalarAsync(token) is null) throw Stale(); }
        await InsertAuditAsync(connection, transaction, id, "Updated", statement.SoaNumber, $"Late charge waived for {schedule.Label}: {request.Reason.Trim()}", statement.Status, calculated, actor, token);
        return await RequiredAsync(connection, transaction, id, token);
    }, token);

    public Task<StatementDto> RecordPaymentAsync(Guid id, RecordStatementPaymentRequest request, CurrentUser actor, CancellationToken token) => ExecuteAsync(async (connection, transaction) =>
    {
        var statement = await LockedStatementAsync(connection, transaction, id, token);
        if (statement.ArchivedAt is not null || statement.Status is "Draft" or "Cancelled") throw new ResourceConflictException("Payments require an active issued statement.");
        await using (var duplicate = connection.CreateCommand())
        {
            duplicate.Transaction = transaction; duplicate.CommandText = "select id from public.statement_payments where statement_id=@statement and idempotency_key=@key"; duplicate.Parameters.AddWithValue("statement", id); duplicate.Parameters.AddWithValue("key", request.IdempotencyKey.Trim());
            if (await duplicate.ExecuteScalarAsync(token) is not null) return await RequiredAsync(connection, transaction, id, token);
        }
        if (statement.Version != request.Version) throw Stale();
        var due = await OutstandingAsync(connection, transaction, id, token);
        if (request.Amount > due.Total + .009m) throw new RequestValidationException("Payment amount cannot exceed the backend-calculated outstanding balance.");
        var late = Math.Min(request.Amount, due.Late); var principal = request.Amount - late;
        await using (var insert = connection.CreateCommand())
        {
            insert.Transaction = transaction; insert.CommandText = "insert into public.statement_payments(statement_id,entry_type,payment_date,amount,principal_amount,late_charge_amount,method,reference_number,notes,idempotency_key,created_by) values(@statement,'Payment',@date,@amount,@principal,@late,@method,@reference,@notes,@key,@actor)";
            insert.Parameters.AddWithValue("statement", id); insert.Parameters.AddWithValue("date", request.PaymentDate); insert.Parameters.AddWithValue("amount", request.Amount); insert.Parameters.AddWithValue("principal", principal); insert.Parameters.AddWithValue("late", late); insert.Parameters.AddWithValue("method", request.Method.Trim()); insert.Parameters.AddWithValue("reference", request.ReferenceNumber?.Trim() ?? string.Empty); insert.Parameters.AddWithValue("notes", request.Notes?.Trim() ?? string.Empty); insert.Parameters.AddWithValue("key", request.IdempotencyKey.Trim()); insert.Parameters.AddWithValue("actor", actor.Id); await insert.ExecuteNonQueryAsync(token);
        }
        var newBalance = decimal.Round(due.Total - request.Amount, 2); var status = CollectionStatus(statement.Status, statement.TotalPayments + request.Amount, newBalance);
        await UpdateFinancialHeaderAsync(connection, transaction, id, request.Version, statement.TotalPayments + request.Amount, newBalance, status, actor.Id, token);
        await InsertAuditAsync(connection, transaction, id, "Payment recorded", statement.SoaNumber, $"Immutable payment recorded by backend allocation. Reference: {request.ReferenceNumber?.Trim() ?? string.Empty}", status, request.Amount, actor, token);
        return await RequiredAsync(connection, transaction, id, token);
    }, token);

    public Task<StatementDto> ReversePaymentAsync(Guid id, Guid paymentId, ReverseStatementPaymentRequest request, CurrentUser actor, CancellationToken token) => ExecuteAsync(async (connection, transaction) =>
    {
        var statement = await LockedStatementAsync(connection, transaction, id, token);
        if (statement.ArchivedAt is not null || statement.Status is "Draft" or "Cancelled") throw new ResourceConflictException("Payment corrections require an active issued statement.");
        if (statement.Version != request.Version) throw Stale();
        StatementPaymentDto payment;
        await using (var read = connection.CreateCommand())
        {
            read.Transaction = transaction; read.CommandText = "select payment.id,payment.entry_type,payment.reverses_payment_id,payment.payment_date,payment.amount,payment.principal_amount,payment.late_charge_amount,payment.method,payment.reference_number,payment.notes,payment.created_at,coalesce(profile.username,'') from public.statement_payments payment left join public.profiles profile on profile.id=payment.created_by where payment.id=@payment and payment.statement_id=@statement"; read.Parameters.AddWithValue("payment", paymentId); read.Parameters.AddWithValue("statement", id);
            await using var reader = await read.ExecuteReaderAsync(token); if (!await reader.ReadAsync(token)) throw new ResourceNotFoundException("Payment was not found."); payment = new(reader.GetGuid(0), reader.GetString(1), reader.IsDBNull(2) ? null : reader.GetGuid(2), reader.GetFieldValue<DateOnly>(3), reader.GetDecimal(4), reader.GetDecimal(5), reader.GetDecimal(6), reader.GetString(7), reader.GetString(8), reader.GetString(9), reader.GetFieldValue<DateTimeOffset>(10), reader.GetString(11));
        }
        if (payment.EntryType != "Payment") throw new RequestValidationException("Only an original payment can be reversed.");
        await using (var exists = connection.CreateCommand()) { exists.Transaction = transaction; exists.CommandText = "select 1 from public.statement_payments where reverses_payment_id=@payment"; exists.Parameters.AddWithValue("payment", paymentId); if (await exists.ExecuteScalarAsync(token) is not null) throw new ResourceConflictException("This payment already has an immutable reversal."); }
        await using (var insert = connection.CreateCommand())
        {
            insert.Transaction = transaction; insert.CommandText = "insert into public.statement_payments(statement_id,entry_type,reverses_payment_id,payment_date,amount,principal_amount,late_charge_amount,method,reference_number,notes,created_by) values(@statement,'Reversal',@payment,@date,@amount,@principal,@late,@method,@reference,@notes,@actor)";
            insert.Parameters.AddWithValue("statement", id); insert.Parameters.AddWithValue("payment", paymentId); insert.Parameters.AddWithValue("date", request.ReversalDate); insert.Parameters.AddWithValue("amount", payment.Amount); insert.Parameters.AddWithValue("principal", payment.PrincipalAmount); insert.Parameters.AddWithValue("late", payment.LateChargeAmount); insert.Parameters.AddWithValue("method", payment.Method); insert.Parameters.AddWithValue("reference", payment.ReferenceNumber); insert.Parameters.AddWithValue("notes", $"Reversal: {request.Reason.Trim()}"); insert.Parameters.AddWithValue("actor", actor.Id); await insert.ExecuteNonQueryAsync(token);
        }
        var newBalance = decimal.Round(statement.Balance + payment.Amount, 2); var totalPayments = Math.Max(0, statement.TotalPayments - payment.Amount); var status = CollectionStatus(statement.Status, totalPayments, newBalance);
        await UpdateFinancialHeaderAsync(connection, transaction, id, request.Version, totalPayments, newBalance, status, actor.Id, token);
        await InsertAuditAsync(connection, transaction, id, "Payment reversed", statement.SoaNumber, $"Immutable reversal recorded: {request.Reason.Trim()}", status, payment.Amount, actor, token);
        return await RequiredAsync(connection, transaction, id, token);
    }, token);

    private static async Task<ResolvedStatement> ResolveAsync(NpgsqlConnection connection, NpgsqlTransaction? transaction, SaveStatementRequest request, Guid? currentId, CancellationToken token)
    {
        string clientName;
        await using (var client = connection.CreateCommand()) { client.Transaction = transaction; client.CommandText = "select name from public.clients where id=@id and status='Active' and archived_at is null and deleted_at is null"; client.Parameters.AddWithValue("id", request.ClientId); clientName = await client.ExecuteScalarAsync(token) as string ?? throw new RequestValidationException("Choose an active Client."); }
        var quotations = new List<ResolvedQuotation>();
        foreach (var quotationId in request.QuotationIds)
        {
            await using var command = connection.CreateCommand(); command.Transaction = transaction;
            command.CommandText = """
                select id,quotation_number,quotation_date,subject,project_location,subtotal_amount,vat_enabled,vat_amount,total_amount
                from public.quotations quotation where id=@id and client_id=@client and status='Approved' and archived_at is null and deleted_at is null
                and not exists(select 1 from public.statement_quotations link join public.statements_of_account statement on statement.id=link.statement_id
                  where link.quotation_id=quotation.id and statement.id<>@current and statement.status<>'Cancelled' and statement.deleted_at is null)
                """;
            command.Parameters.AddWithValue("id", quotationId); command.Parameters.AddWithValue("client", request.ClientId); command.Parameters.AddWithValue("current", currentId ?? Guid.Empty);
            await using var reader = await command.ExecuteReaderAsync(token); if (!await reader.ReadAsync(token)) throw new RequestValidationException("Choose approved quotations for this Client that are not linked to another active statement.");
            quotations.Add(new(reader.GetGuid(0), reader.GetString(1), reader.GetFieldValue<DateOnly>(2), reader.GetString(3), reader.GetString(4), reader.GetDecimal(5), reader.GetBoolean(6), reader.GetDecimal(7), reader.GetDecimal(8)));
        }
        var totalCharges = decimal.Round(quotations.Sum(value => value.Total), 2); var principal = decimal.Round(request.OpeningBalance + totalCharges, 2);
        var schedules = PrepareSchedules(request, principal); var dueDate = schedules.Min(value => value.DueDate); var status = request.Intent?.Equals("issue", StringComparison.OrdinalIgnoreCase) == true ? "Issued" : "Draft";
        return new(clientName, quotations, schedules, totalCharges, principal, dueDate, status);
    }

    private static IReadOnlyList<StatementScheduleRequest> PrepareSchedules(SaveStatementRequest request, decimal principal)
    {
        if (principal <= 0) throw new RequestValidationException("Statement total must be greater than zero.");
        IReadOnlyList<StatementScheduleRequest> schedules = request.PaymentArrangement == "Full payment" ? [new("Full payment", request.DueDate, principal, null, null, null, null)] : request.PaymentSchedule;
        if (schedules.Count == 0 || schedules.Count > 12 || request.PaymentArrangement == "Installment" && schedules.Count < 2 || decimal.Round(schedules.Sum(entry => entry.Amount), 2) != principal) throw new RequestValidationException("Payment schedule amounts must equal the backend-calculated statement total.");
        return schedules;
    }

    private static async Task<string> ReserveNumberAsync(NpgsqlConnection connection, NpgsqlTransaction? transaction, DateOnly date, CancellationToken token)
    {
        await using var command = connection.CreateCommand(); command.Transaction = transaction; command.CommandText = "select public.next_document_number('statement_of_account',@date)"; command.Parameters.AddWithValue("date", date); return (string?)await command.ExecuteScalarAsync(token) ?? throw new InvalidOperationException("Statement number could not be reserved.");
    }

    private static async Task InsertHeaderAsync(NpgsqlConnection connection, NpgsqlTransaction? transaction, Guid id, string number, SaveStatementRequest request, ResolvedStatement resolved, CurrentUser actor, CancellationToken token)
    {
        await using var command = connection.CreateCommand(); command.Transaction = transaction;
        command.CommandText = """
            insert into public.statements_of_account(id,soa_number,statement_date,coverage_from,coverage_to,due_date,client_id,client_name,contact_person,opening_balance,total_charges,total_payments,balance,payment_arrangement,payment_frequency,late_charge_enabled,late_charge_grace_days,late_charge_type,late_charge_value,status,notes,terms,issued_at,issued_by,created_by,updated_by)
            values(@id,@number,@statement_date,@coverage_from,@coverage_to,@due_date,@client_id,@client_name,@contact_person,@opening_balance,@total_charges,0,@balance,@arrangement,@frequency,@late_enabled,@grace_days,@late_type,@late_value,@status,@notes,@terms,case when @status='Issued' then now() end,case when @status='Issued' then @actor end,@actor,@actor)
            """;
        AddHeaderParameters(command, id, request, resolved, actor.Id); command.Parameters.AddWithValue("number", number); await command.ExecuteNonQueryAsync(token);
    }

    private static void AddHeaderParameters(NpgsqlCommand command, Guid id, SaveStatementRequest request, ResolvedStatement resolved, Guid actor)
    {
        command.Parameters.AddWithValue("id", id); command.Parameters.AddWithValue("statement_date", request.StatementDate); command.Parameters.AddWithValue("coverage_from", request.CoverageFrom); command.Parameters.AddWithValue("coverage_to", request.CoverageTo); command.Parameters.AddWithValue("due_date", resolved.DueDate); command.Parameters.AddWithValue("client_id", request.ClientId); command.Parameters.AddWithValue("client_name", resolved.ClientName); command.Parameters.AddWithValue("contact_person", request.ContactPerson?.Trim() ?? string.Empty); command.Parameters.AddWithValue("opening_balance", request.OpeningBalance); command.Parameters.AddWithValue("total_charges", resolved.TotalCharges); command.Parameters.AddWithValue("balance", resolved.Balance); command.Parameters.AddWithValue("arrangement", request.PaymentArrangement); command.Parameters.AddWithValue("frequency", request.PaymentFrequency); command.Parameters.AddWithValue("late_enabled", request.LateChargeEnabled); command.Parameters.AddWithValue("grace_days", request.LateChargeGraceDays); command.Parameters.AddWithValue("late_type", request.LateChargeType); command.Parameters.AddWithValue("late_value", request.LateChargeValue); command.Parameters.AddWithValue("status", resolved.Status); command.Parameters.AddWithValue("notes", request.Notes?.Trim() ?? string.Empty); command.Parameters.AddWithValue("terms", request.Terms?.Trim() ?? string.Empty); command.Parameters.AddWithValue("actor", actor);
    }

    private static async Task ReplaceChildrenAsync(NpgsqlConnection connection, NpgsqlTransaction? transaction, Guid statementId, ResolvedStatement resolved, CancellationToken token)
    {
        await using (var delete = connection.CreateCommand()) { delete.Transaction = transaction; delete.CommandText = "delete from public.statement_quotations where statement_id=@id; delete from public.payment_schedules where statement_id=@id"; delete.Parameters.AddWithValue("id", statementId); await delete.ExecuteNonQueryAsync(token); }
        for (var index = 0; index < resolved.Quotations.Count; index++) await SnapshotQuotationAsync(connection, transaction, statementId, resolved.Quotations[index], index + 1, token);
        for (var index = 0; index < resolved.Schedules.Count; index++)
        {
            var entry = resolved.Schedules[index]; await using var command = connection.CreateCommand(); command.Transaction = transaction;
            command.CommandText = "insert into public.payment_schedules(statement_id,position,label,due_date,amount,late_charge_enabled,late_charge_grace_days,late_charge_type,late_charge_value) values(@statement,@position,@label,@due_date,@amount,@enabled,@grace,@type,@value)";
            command.Parameters.AddWithValue("statement", statementId); command.Parameters.AddWithValue("position", index + 1); command.Parameters.AddWithValue("label", entry.Label.Trim()); command.Parameters.AddWithValue("due_date", entry.DueDate); command.Parameters.AddWithValue("amount", entry.Amount); command.Parameters.AddWithValue("enabled", (object?)entry.LateChargeEnabled ?? DBNull.Value); command.Parameters.AddWithValue("grace", (object?)entry.LateChargeGraceDays ?? DBNull.Value); command.Parameters.AddWithValue("type", (object?)entry.LateChargeType ?? DBNull.Value); command.Parameters.AddWithValue("value", (object?)entry.LateChargeValue ?? DBNull.Value); await command.ExecuteNonQueryAsync(token);
        }
    }

    private static async Task SnapshotQuotationAsync(NpgsqlConnection connection, NpgsqlTransaction? transaction, Guid statementId, ResolvedQuotation quotation, int position, CancellationToken token)
    {
        var snapshotId = Guid.NewGuid();
        await using (var header = connection.CreateCommand()) { header.Transaction = transaction; header.CommandText = "insert into public.statement_quotations(id,statement_id,quotation_id,position,quotation_number,quotation_date,subject,project_location,subtotal_amount,vat_enabled,vat_amount,total_amount) values(@id,@statement,@quotation,@position,@number,@date,@subject,@location,@subtotal,@vat_enabled,@vat,@total)"; header.Parameters.AddWithValue("id", snapshotId); header.Parameters.AddWithValue("statement", statementId); header.Parameters.AddWithValue("quotation", quotation.Id); header.Parameters.AddWithValue("position", position); header.Parameters.AddWithValue("number", quotation.Number); header.Parameters.AddWithValue("date", quotation.Date); header.Parameters.AddWithValue("subject", quotation.Subject); header.Parameters.AddWithValue("location", quotation.Location); header.Parameters.AddWithValue("subtotal", quotation.Subtotal); header.Parameters.AddWithValue("vat_enabled", quotation.VatEnabled); header.Parameters.AddWithValue("vat", quotation.Vat); header.Parameters.AddWithValue("total", quotation.Total); await header.ExecuteNonQueryAsync(token); }
        await using (var lines = connection.CreateCommand()) { lines.Transaction = transaction; lines.CommandText = "insert into public.statement_items(statement_quotation_id,item_id,variant_id,position,photo_url,item_name,variant_label,product_code,unit_of_measure,quantity,unit_price,amount) select @snapshot,item_id,variant_id,position,photo_url,item_name,variant_label,product_code,unit_of_measure,quantity,unit_price,line_amount from public.quotation_lines where quotation_id=@quotation"; lines.Parameters.AddWithValue("snapshot", snapshotId); lines.Parameters.AddWithValue("quotation", quotation.Id); await lines.ExecuteNonQueryAsync(token); }
        await using var charges = connection.CreateCommand(); charges.Transaction = transaction; charges.CommandText = "insert into public.statement_quotation_charges(statement_quotation_id,label,amount,position) select @snapshot,label,amount,position from public.quotation_charges where quotation_id=@quotation"; charges.Parameters.AddWithValue("snapshot", snapshotId); charges.Parameters.AddWithValue("quotation", quotation.Id); await charges.ExecuteNonQueryAsync(token);
    }

    private static async Task<StatementDto?> ReadAsync(NpgsqlConnection connection, NpgsqlTransaction? transaction, Guid id, CancellationToken token)
    {
        Header header;
        await using (var command = connection.CreateCommand())
        {
            command.Transaction = transaction; command.CommandText = "select id,soa_number,statement_date,coverage_from,coverage_to,due_date,client_id,client_name,contact_person,opening_balance,total_charges,total_payments,balance,payment_arrangement,payment_frequency,late_charge_enabled,late_charge_grace_days,late_charge_type,late_charge_value,status,notes,terms,void_reason,created_at,updated_at,archived_at,version from public.statements_of_account where id=@id and deleted_at is null"; command.Parameters.AddWithValue("id", id);
            await using var reader = await command.ExecuteReaderAsync(token); if (!await reader.ReadAsync(token)) return null;
            header = new(reader.GetGuid(0), reader.GetString(1), reader.GetFieldValue<DateOnly>(2), reader.GetFieldValue<DateOnly>(3), reader.GetFieldValue<DateOnly>(4), reader.GetFieldValue<DateOnly>(5), reader.IsDBNull(6) ? null : reader.GetGuid(6), reader.GetString(7), reader.GetString(8), reader.GetDecimal(9), reader.GetDecimal(10), reader.GetDecimal(11), reader.GetDecimal(12), reader.GetString(13), reader.GetString(14), reader.GetBoolean(15), reader.GetInt32(16), reader.GetString(17), reader.GetDecimal(18), reader.GetString(19), reader.GetString(20), reader.GetString(21), reader.IsDBNull(22) ? null : reader.GetString(22), reader.GetFieldValue<DateTimeOffset>(23), reader.GetFieldValue<DateTimeOffset>(24), reader.IsDBNull(25) ? null : reader.GetFieldValue<DateTimeOffset>(25), reader.GetInt64(26));
        }
        var quotations = await ReadQuotationsAsync(connection, transaction, id, token); var schedules = await ReadSchedulesAsync(connection, transaction, id, token); var lateCharges = await ReadLateChargesAsync(connection, transaction, id, token); var payments = await ReadPaymentsAsync(connection, transaction, id, token);
        return new(header.Id, header.Number, header.StatementDate, header.CoverageFrom, header.CoverageTo, header.DueDate, header.ClientId, header.ClientName, header.ContactPerson, header.OpeningBalance, header.TotalCharges, header.TotalPayments, header.Balance, header.Arrangement, header.Frequency, header.LateEnabled, header.GraceDays, header.LateType, header.LateValue, header.Status, header.Notes, header.Terms, header.VoidReason, quotations, schedules, lateCharges, payments, header.CreatedAt, header.UpdatedAt, header.ArchivedAt, header.Version);
    }

    private static async Task<IReadOnlyList<StatementQuotationDto>> ReadQuotationsAsync(NpgsqlConnection connection, NpgsqlTransaction? transaction, Guid statementId, CancellationToken token)
    {
        var headers = new List<QuotationHeader>(); await using (var command = connection.CreateCommand()) { command.Transaction = transaction; command.CommandText = "select id,quotation_id,quotation_number,quotation_date,subject,project_location,subtotal_amount,vat_enabled,vat_amount,total_amount from public.statement_quotations where statement_id=@id order by position"; command.Parameters.AddWithValue("id", statementId); await using var reader = await command.ExecuteReaderAsync(token); while (await reader.ReadAsync(token)) headers.Add(new(reader.GetGuid(0), reader.IsDBNull(1) ? null : reader.GetGuid(1), reader.GetString(2), reader.GetFieldValue<DateOnly>(3), reader.GetString(4), reader.GetString(5), reader.GetDecimal(6), reader.GetBoolean(7), reader.GetDecimal(8), reader.GetDecimal(9))); }
        var results = new List<StatementQuotationDto>(); foreach (var header in headers) { var items = new List<StatementItemDto>(); await using (var command = connection.CreateCommand()) { command.Transaction = transaction; command.CommandText = "select id,item_id,variant_id,photo_url,item_name,variant_label,product_code,unit_of_measure,quantity,unit_price,amount from public.statement_items where statement_quotation_id=@id order by position"; command.Parameters.AddWithValue("id", header.Id); await using var reader = await command.ExecuteReaderAsync(token); while (await reader.ReadAsync(token)) items.Add(new(reader.GetGuid(0), reader.IsDBNull(1) ? null : reader.GetGuid(1), reader.IsDBNull(2) ? null : reader.GetGuid(2), reader.IsDBNull(3) ? string.Empty : reader.GetString(3), reader.GetString(4), reader.GetString(5), reader.GetString(6), reader.GetString(7), reader.GetDecimal(8), reader.GetDecimal(9), reader.GetDecimal(10))); } var charges = new List<StatementChargeDto>(); await using (var command = connection.CreateCommand()) { command.Transaction = transaction; command.CommandText = "select id,label,amount,position from public.statement_quotation_charges where statement_quotation_id=@id order by position"; command.Parameters.AddWithValue("id", header.Id); await using var reader = await command.ExecuteReaderAsync(token); while (await reader.ReadAsync(token)) charges.Add(new(reader.GetGuid(0), reader.GetString(1), reader.GetDecimal(2), reader.GetInt32(3))); } results.Add(new(header.Id, header.QuotationId, header.Number, header.Date, header.Subject, header.Location, header.Subtotal, header.VatEnabled, header.Vat, header.Total, items, charges)); }
        return results;
    }

    private static async Task<IReadOnlyList<StatementScheduleDto>> ReadSchedulesAsync(NpgsqlConnection connection, NpgsqlTransaction? transaction, Guid statementId, CancellationToken token)
    {
        var results = new List<StatementScheduleDto>(); await using var command = connection.CreateCommand(); command.Transaction = transaction; command.CommandText = "select id,position,label,due_date,amount,late_charge_enabled,late_charge_grace_days,late_charge_type,late_charge_value,version from public.payment_schedules where statement_id=@id order by position"; command.Parameters.AddWithValue("id", statementId); await using var reader = await command.ExecuteReaderAsync(token); while (await reader.ReadAsync(token)) results.Add(new(reader.GetGuid(0), reader.GetInt32(1), reader.GetString(2), reader.GetFieldValue<DateOnly>(3), reader.GetDecimal(4), reader.IsDBNull(5) ? null : reader.GetBoolean(5), reader.IsDBNull(6) ? null : reader.GetInt32(6), reader.IsDBNull(7) ? null : reader.GetString(7), reader.IsDBNull(8) ? null : reader.GetDecimal(8), reader.GetInt64(9))); return results;
    }

    private static async Task<IReadOnlyList<StatementLateChargeDto>> ReadLateChargesAsync(NpgsqlConnection connection, NpgsqlTransaction? transaction, Guid statementId, CancellationToken token)
    {
        var results = new List<StatementLateChargeDto>(); await using var command = connection.CreateCommand(); command.Transaction = transaction; command.CommandText = "select charge.id,charge.payment_schedule_id,charge.applied_date,charge.charge_type,charge.rate_value,charge.calculated_amount,charge.amount,charge.status,charge.reason,coalesce(profile.username,''),charge.created_at,charge.updated_at,charge.version from public.statement_late_charges charge left join public.profiles profile on profile.id=charge.created_by where charge.statement_id=@id order by charge.created_at"; command.Parameters.AddWithValue("id", statementId); await using var reader = await command.ExecuteReaderAsync(token); while (await reader.ReadAsync(token)) results.Add(new(reader.GetGuid(0), reader.GetGuid(1), reader.GetFieldValue<DateOnly>(2), reader.GetString(3), reader.GetDecimal(4), reader.GetDecimal(5), reader.GetDecimal(6), reader.GetString(7), reader.GetString(8), reader.GetString(9), reader.GetFieldValue<DateTimeOffset>(10), reader.GetFieldValue<DateTimeOffset>(11), reader.GetInt64(12))); return results;
    }

    private static async Task<IReadOnlyList<StatementPaymentDto>> ReadPaymentsAsync(NpgsqlConnection connection, NpgsqlTransaction? transaction, Guid statementId, CancellationToken token)
    {
        var results = new List<StatementPaymentDto>(); await using var command = connection.CreateCommand(); command.Transaction = transaction; command.CommandText = "select payment.id,payment.entry_type,payment.reverses_payment_id,payment.payment_date,payment.amount,payment.principal_amount,payment.late_charge_amount,payment.method,payment.reference_number,payment.notes,payment.created_at,coalesce(profile.username,'') from public.statement_payments payment left join public.profiles profile on profile.id=payment.created_by where payment.statement_id=@id order by payment.payment_date desc,payment.created_at desc"; command.Parameters.AddWithValue("id", statementId); await using var reader = await command.ExecuteReaderAsync(token); while (await reader.ReadAsync(token)) results.Add(new(reader.GetGuid(0), reader.GetString(1), reader.IsDBNull(2) ? null : reader.GetGuid(2), reader.GetFieldValue<DateOnly>(3), reader.GetDecimal(4), reader.GetDecimal(5), reader.GetDecimal(6), reader.GetString(7), reader.GetString(8), reader.GetString(9), reader.GetFieldValue<DateTimeOffset>(10), reader.GetString(11))); return results;
    }

    private static async Task<StatementDto> LockedStatementAsync(NpgsqlConnection connection, NpgsqlTransaction? transaction, Guid id, CancellationToken token)
    {
        await using var lockCommand = connection.CreateCommand(); lockCommand.Transaction = transaction; lockCommand.CommandText = "select id from public.statements_of_account where id=@id and deleted_at is null for update"; lockCommand.Parameters.AddWithValue("id", id); if (await lockCommand.ExecuteScalarAsync(token) is null) throw new ResourceNotFoundException($"Statement '{id}' was not found."); return await RequiredAsync(connection, transaction, id, token);
    }

    private static async Task<(decimal Total, decimal Late)> OutstandingAsync(NpgsqlConnection connection, NpgsqlTransaction? transaction, Guid statementId, CancellationToken token)
    {
        await using var command = connection.CreateCommand(); command.Transaction = transaction; command.CommandText = "select statement.balance, greatest(0,coalesce((select sum(case when payment.entry_type='Payment' then payment.late_charge_amount else -payment.late_charge_amount end) from public.statement_payments payment where payment.statement_id=statement.id),0)), greatest(0,coalesce((select sum(charge.amount) from public.statement_late_charges charge where charge.statement_id=statement.id and charge.status='Applied'),0)) from public.statements_of_account statement where statement.id=@id"; command.Parameters.AddWithValue("id", statementId); await using var reader = await command.ExecuteReaderAsync(token); if (!await reader.ReadAsync(token)) throw new ResourceNotFoundException($"Statement '{statementId}' was not found."); var total = reader.GetDecimal(0); var late = Math.Min(total, Math.Max(0, reader.GetDecimal(2) - reader.GetDecimal(1))); return (total, late);
    }

    private static async Task UpdateFinancialHeaderAsync(NpgsqlConnection connection, NpgsqlTransaction? transaction, Guid id, long version, decimal totalPayments, decimal balance, string status, Guid actor, CancellationToken token)
    {
        await using var command = connection.CreateCommand(); command.Transaction = transaction; command.CommandText = "update public.statements_of_account set total_payments=@payments,balance=@balance,status=@status,updated_by=@actor where id=@id and version=@version returning id"; command.Parameters.AddWithValue("payments", totalPayments); command.Parameters.AddWithValue("balance", balance); command.Parameters.AddWithValue("status", status); command.Parameters.AddWithValue("actor", actor); command.Parameters.AddWithValue("id", id); command.Parameters.AddWithValue("version", version); if (await command.ExecuteScalarAsync(token) is null) throw Stale();
    }

    private static string CollectionStatus(string current, decimal totalPayments, decimal balance) => balance <= .009m ? "Settled" : totalPayments > .009m ? "Partially Settled" : current == "Overdue" ? "Overdue" : "Issued";

    private static async Task<StatementDto> RequiredAsync(NpgsqlConnection connection, NpgsqlTransaction? transaction, Guid id, CancellationToken token) => await ReadAsync(connection, transaction, id, token) ?? throw new ResourceNotFoundException($"Statement '{id}' was not found.");
    private static void AddListParameters(NpgsqlCommand command, string search, string? status, bool archived, int page, int size) { command.Parameters.AddWithValue("archived_only", archived); command.Parameters.AddWithValue("status", status ?? string.Empty); command.Parameters.AddWithValue("search", string.IsNullOrWhiteSpace(search) ? string.Empty : $"%{search}%"); command.Parameters.AddWithValue("limit", size); command.Parameters.AddWithValue("offset", (page - 1) * size); }
    private static void ValidateTransition(string current, string target, string? reason) { var valid = (current, target) is ("Draft", "Issued") or ("Draft", "Cancelled") or ("Issued", "Overdue") or ("Issued", "Cancelled") or ("Overdue", "Cancelled"); if (!valid) throw new ResourceConflictException($"Statement cannot change from {current} to {target}."); if (target == "Cancelled" && string.IsNullOrWhiteSpace(reason)) throw new RequestValidationException("A void reason is required."); }
    private static async Task InsertAuditAsync(NpgsqlConnection connection, NpgsqlTransaction? transaction, Guid id, string action, string entity, string description, string status, decimal amount, CurrentUser actor, CancellationToken token) { await using var command = connection.CreateCommand(); command.Transaction = transaction; command.CommandText = "insert into public.audit_records(record_id,module,action,entity,description,actor_id,actor_name,tone,amount,status) values(@id,'Statements of Account',@action,@entity,@description,@actor,@name,@tone,@amount,@status)"; command.Parameters.AddWithValue("id", id); command.Parameters.AddWithValue("action", action); command.Parameters.AddWithValue("entity", entity); command.Parameters.AddWithValue("description", description); command.Parameters.AddWithValue("actor", actor.Id); command.Parameters.AddWithValue("name", actor.Username); command.Parameters.AddWithValue("tone", action == "Created" ? "success" : action == "Voided" ? "danger" : "info"); command.Parameters.AddWithValue("amount", amount); command.Parameters.AddWithValue("status", status); await command.ExecuteNonQueryAsync(token); }
    private async Task<T> ExecuteAsync<T>(Func<NpgsqlConnection, NpgsqlTransaction?, Task<T>> action, CancellationToken token) { await using var connection = await dataSource.OpenConnectionAsync(token); await using var transaction = Transaction.Current is null ? await connection.BeginTransactionAsync(token) : null; var value = await action(connection, transaction); if (transaction is not null) await transaction.CommitAsync(token); return value; }
    private static ConcurrencyConflictException Stale() => new("This statement changed after you opened it. Reload and try again.");

    private sealed record ResolvedQuotation(Guid Id, string Number, DateOnly Date, string Subject, string Location, decimal Subtotal, bool VatEnabled, decimal Vat, decimal Total);
    private sealed record ResolvedStatement(string ClientName, IReadOnlyList<ResolvedQuotation> Quotations, IReadOnlyList<StatementScheduleRequest> Schedules, decimal TotalCharges, decimal Balance, DateOnly DueDate, string Status);
    private sealed record QuotationHeader(Guid Id, Guid? QuotationId, string Number, DateOnly Date, string Subject, string Location, decimal Subtotal, bool VatEnabled, decimal Vat, decimal Total);
    private sealed record Header(Guid Id, string Number, DateOnly StatementDate, DateOnly CoverageFrom, DateOnly CoverageTo, DateOnly DueDate, Guid? ClientId, string ClientName, string ContactPerson, decimal OpeningBalance, decimal TotalCharges, decimal TotalPayments, decimal Balance, string Arrangement, string Frequency, bool LateEnabled, int GraceDays, string LateType, decimal LateValue, string Status, string Notes, string Terms, string? VoidReason, DateTimeOffset CreatedAt, DateTimeOffset UpdatedAt, DateTimeOffset? ArchivedAt, long Version);
}
