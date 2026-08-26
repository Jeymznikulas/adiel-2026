using System.Net;
using System.Net.Http.Json;
using AdielSystem.Application.Clients;
using AdielSystem.Application.Quotations;
using AdielSystem.Application.Statements;

namespace AdielSystem.IntegrationTests;

public sealed class AuthenticatedStatementFlowTests
{
    [Fact]
    public async Task Owner_can_create_calculated_statement_validate_links_apply_late_charge_and_complete_lifecycle()
    {
        await using var factory = new OwnerApiFactory(); using var client = factory.CreateClient(); var token = TestContext.Current.CancellationToken;
        var hasPaymentIdempotency = await factory.QueryInTestTransactionAsync(async connection => { await using var command = connection.CreateCommand(); command.CommandText = "select exists(select 1 from information_schema.columns where table_schema='public' and table_name='statement_payments' and column_name='idempotency_key')"; return (bool)(await command.ExecuteScalarAsync(token) ?? false); }, token);
        Assert.True(hasPaymentIdempotency, "Apply migration 20260825030000_statement_payment_idempotency.sql before running payment integration tests.");
        var industries = await client.GetFromJsonAsync<ClientIndustryDto[]>("/api/v1/clients/industries", token);
        var contactId = Guid.NewGuid();
        var clientResponse = await client.PostAsJsonAsync("/api/v1/clients", new { name = $"SOA Client {Guid.NewGuid():N}", photo = (string?)null, address = "Manila", industry = industries!.First(value => value.IsActive).Name, clientSince = "2026-07-01", status = "Active", contacts = new[] { new { id = contactId, name = "Accounts", email = "accounts@example.com", phone = "123" } } }, token);
        clientResponse.EnsureSuccessStatusCode(); var savedClient = await clientResponse.Content.ReadFromJsonAsync<ClientDto>(token);

        var quotationResponse = await client.PostAsJsonAsync("/api/v1/quotations", new { quotationDate = "2026-07-01", clientId = savedClient!.Id, clientName = "tampered", contactId, contactPerson = "tampered", subject = "SOA work", projectLocation = "Manila", leadTime = "7 days", notes = "", terms = "", vatEnabled = false, intent = "submit", lines = new[] { new { itemId = (Guid?)null, variantId = (Guid?)null, photo = "", itemName = "Historical item", variantLabel = "", productCode = "HIST", unitOfMeasure = "Piece", quantity = 2m, unitPrice = 100m, unitCost = 50m } }, charges = new[] { new { label = "Delivery", amount = 10m } } }, token);
        quotationResponse.EnsureSuccessStatusCode(); var quotation = await quotationResponse.Content.ReadFromJsonAsync<QuotationDto>(token);

        var ineligible = await client.PostAsJsonAsync("/api/v1/statements", Request(savedClient.Id, quotation!.Id), token);
        Assert.Equal(HttpStatusCode.BadRequest, ineligible.StatusCode);
        var approval = await client.PostAsJsonAsync($"/api/v1/quotations/{quotation.Id}/status", new { status = "Approved", reason = (string?)null, version = quotation.Version }, token); approval.EnsureSuccessStatusCode();

        var create = await client.PostAsJsonAsync("/api/v1/statements", Request(savedClient.Id, quotation.Id), token);
        Assert.Equal(HttpStatusCode.Created, create.StatusCode); var statement = await create.Content.ReadFromJsonAsync<StatementDto>(token); Assert.NotNull(statement);
        Assert.StartsWith("SOA-", statement!.SoaNumber); Assert.Equal(210m, statement.TotalCharges); Assert.Equal(260m, statement.Balance); Assert.Equal(0m, statement.TotalPayments); Assert.Equal(2, statement.PaymentSchedule.Count); Assert.Single(statement.Quotations); Assert.Single(statement.Quotations[0].Items); Assert.Single(statement.Quotations[0].Charges);

        var duplicate = await client.PostAsJsonAsync("/api/v1/statements", Request(savedClient.Id, quotation.Id), token);
        Assert.Equal(HttpStatusCode.BadRequest, duplicate.StatusCode);
        var updateRequest = Request(savedClient.Id, quotation.Id, statement.Version);
        var update = await client.PutAsJsonAsync($"/api/v1/statements/{statement.Id}", updateRequest, token); update.EnsureSuccessStatusCode(); var updated = await update.Content.ReadFromJsonAsync<StatementDto>(token);
        var stale = await client.PutAsJsonAsync($"/api/v1/statements/{statement.Id}", updateRequest, token); Assert.Equal(HttpStatusCode.Conflict, stale.StatusCode);
        var issue = await client.PostAsJsonAsync($"/api/v1/statements/{statement.Id}/status", new { status = "Issued", reason = (string?)null, version = updated!.Version }, token); issue.EnsureSuccessStatusCode(); var issued = await issue.Content.ReadFromJsonAsync<StatementDto>(token);
        var partialRequest = new { paymentDate = "2026-08-02", amount = 100m, method = "Bank transfer", referenceNumber = "TXN-100", notes = "partial", idempotencyKey = $"pay-{Guid.NewGuid():N}", version = issued!.Version };
        var partialResponse = await client.PostAsJsonAsync($"/api/v1/statements/{statement.Id}/payments", partialRequest, token); partialResponse.EnsureSuccessStatusCode(); var partial = await partialResponse.Content.ReadFromJsonAsync<StatementDto>(token); Assert.Equal("Partially Settled", partial!.Status); Assert.Equal(160m, partial.Balance); Assert.Single(partial.Payments);
        var duplicatePayment = await client.PostAsJsonAsync($"/api/v1/statements/{statement.Id}/payments", partialRequest, token); duplicatePayment.EnsureSuccessStatusCode(); Assert.Single((await duplicatePayment.Content.ReadFromJsonAsync<StatementDto>(token))!.Payments);
        var winningPayment = await client.PostAsJsonAsync($"/api/v1/statements/{statement.Id}/payments", new { paymentDate = "2026-08-03", amount = 100m, method = "Cash", referenceNumber = "TXN-200A", notes = "", idempotencyKey = $"pay-{Guid.NewGuid():N}", version = partial.Version }, token); winningPayment.EnsureSuccessStatusCode();
        var concurrentLoser = await client.PostAsJsonAsync($"/api/v1/statements/{statement.Id}/payments", new { paymentDate = "2026-08-03", amount = 100m, method = "Cash", referenceNumber = "TXN-200B", notes = "", idempotencyKey = $"pay-{Guid.NewGuid():N}", version = partial.Version }, token); Assert.Equal(HttpStatusCode.Conflict, concurrentLoser.StatusCode);
        var collected = await winningPayment.Content.ReadFromJsonAsync<StatementDto>(token); Assert.Equal(60m, collected!.Balance); Assert.Equal(200m, collected.TotalPayments);
        var late = await client.PostAsJsonAsync($"/api/v1/statements/{statement.Id}/schedules/{collected.PaymentSchedule[0].Id}/late-charge", new { version = collected.Version }, token); late.EnsureSuccessStatusCode(); var charged = await late.Content.ReadFromJsonAsync<StatementDto>(token); Assert.Equal(25m, charged!.LateCharges.Single().Amount); Assert.Equal(85m, charged.Balance);
        var lateAgain = await client.PostAsJsonAsync($"/api/v1/statements/{statement.Id}/schedules/{issued.PaymentSchedule[0].Id}/late-charge", new { version = charged.Version }, token); Assert.Equal(HttpStatusCode.Conflict, lateAgain.StatusCode);
        var waive = await client.PostAsJsonAsync($"/api/v1/statements/{statement.Id}/schedules/{collected.PaymentSchedule[0].Id}/late-charge/waive", new { reason = "Courtesy waiver", version = charged.Version }, token); waive.EnsureSuccessStatusCode(); var waived = await waive.Content.ReadFromJsonAsync<StatementDto>(token); Assert.Equal("Waived", waived!.LateCharges.Single().Status); Assert.Equal(60m, waived.Balance);
        var full = await client.PostAsJsonAsync($"/api/v1/statements/{statement.Id}/payments", new { paymentDate = "2026-08-04", amount = 60m, method = "Cash", referenceNumber = "TXN-260", notes = "full", idempotencyKey = $"pay-{Guid.NewGuid():N}", version = waived.Version }, token); full.EnsureSuccessStatusCode(); var settled = await full.Content.ReadFromJsonAsync<StatementDto>(token); Assert.Equal("Settled", settled!.Status); Assert.Equal(0m, settled.Balance);
        var overpayment = await client.PostAsJsonAsync($"/api/v1/statements/{statement.Id}/payments", new { paymentDate = "2026-08-04", amount = 1m, method = "Cash", referenceNumber = "TXN-OVER", notes = "", idempotencyKey = $"pay-{Guid.NewGuid():N}", version = settled.Version }, token); Assert.Equal(HttpStatusCode.BadRequest, overpayment.StatusCode);
        var originalPayment = settled.Payments.Single(payment => payment.ReferenceNumber == "TXN-100"); var reversal = await client.PostAsJsonAsync($"/api/v1/statements/{statement.Id}/payments/{originalPayment.Id}/reverse", new { reversalDate = "2026-08-05", reason = "Returned funds", version = settled.Version }, token); reversal.EnsureSuccessStatusCode(); var reversed = await reversal.Content.ReadFromJsonAsync<StatementDto>(token); Assert.Equal("Partially Settled", reversed!.Status); Assert.Equal(100m, reversed.Balance); Assert.Contains(reversed.Payments, payment => payment.EntryType == "Reversal");
        var duplicateReversal = await client.PostAsJsonAsync($"/api/v1/statements/{statement.Id}/payments/{originalPayment.Id}/reverse", new { reversalDate = "2026-08-05", reason = "Returned funds", version = reversed.Version }, token); Assert.Equal(HttpStatusCode.Conflict, duplicateReversal.StatusCode);

        var auditCount = await factory.QueryInTestTransactionAsync(async connection => { await using var command = connection.CreateCommand(); command.CommandText = "select count(*) from public.audit_records where module='Statements of Account' and record_id=@id"; command.Parameters.AddWithValue("id", statement.Id); return (long)(await command.ExecuteScalarAsync(token) ?? 0L); }, token);
        Assert.True(auditCount >= 9);
    }

    private static object Request(Guid clientId, Guid quotationId, long? version = null) => new { statementDate = "2026-07-01", coverageFrom = "2026-07-01", coverageTo = "2026-07-31", dueDate = "2026-08-01", clientId, contactPerson = "Accounts", openingBalance = 50m, paymentArrangement = "Installment", paymentFrequency = "Monthly", lateChargeEnabled = true, lateChargeGraceDays = 0, lateChargeType = "Fixed amount", lateChargeValue = 25m, notes = "", terms = "", quotationIds = new[] { quotationId }, paymentSchedule = new[] { new { label = "Installment 1 of 2", dueDate = "2026-08-01", amount = 100m, lateChargeEnabled = (bool?)null, lateChargeGraceDays = (int?)null, lateChargeType = (string?)null, lateChargeValue = (decimal?)null }, new { label = "Installment 2 of 2", dueDate = "2026-09-01", amount = 160m, lateChargeEnabled = (bool?)null, lateChargeGraceDays = (int?)null, lateChargeType = (string?)null, lateChargeValue = (decimal?)null } }, intent = "draft", version };
}
