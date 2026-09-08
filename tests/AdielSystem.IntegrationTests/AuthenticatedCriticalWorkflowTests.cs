using System.Net;
using System.Net.Http.Json;
using AdielSystem.Application.Clients;
using AdielSystem.Application.Expenses;
using AdielSystem.Application.Items;
using AdielSystem.Application.PurchaseOrders;
using AdielSystem.Application.Quotations;
using AdielSystem.Application.Settings;
using AdielSystem.Application.Statements;
using AdielSystem.Application.Suppliers;

namespace AdielSystem.IntegrationTests;

public sealed class AuthenticatedCriticalWorkflowTests
{
    [Fact]
    public async Task Owner_can_complete_client_to_payment_workflow_in_one_transaction()
    {
        await using var factory = new OwnerApiFactory();
        using var client = factory.CreateClient();
        var token = TestContext.Current.CancellationToken;

        var industries = await client.GetFromJsonAsync<ClientIndustryDto[]>("/api/v1/clients/industries", token);
        var itemCategories = await client.GetFromJsonAsync<BusinessOptionDto[]>("/api/v1/settings/options?type=item_category", token);
        var paymentMethods = await client.GetFromJsonAsync<BusinessOptionDto[]>("/api/v1/settings/options?type=payment_method", token);
        var paymentMethod = paymentMethods!.First(value => value.IsActive).Name;
        var contactId = Guid.NewGuid();
        var unique = Guid.NewGuid().ToString("N");

        var clientResponse = await client.PostAsJsonAsync("/api/v1/clients", new
        {
            name = $"Critical Workflow Client {unique}", photo = (string?)null, address = "Manila",
            industry = industries!.First(value => value.IsActive).Name, clientSince = "2026-08-30", status = "Active",
            contacts = new[] { new { id = contactId, name = "Accounts", email = "accounts@example.com", phone = "123" } },
        }, token);
        clientResponse.EnsureSuccessStatusCode();
        var savedClient = (await clientResponse.Content.ReadFromJsonAsync<ClientDto>(token))!;

        var supplierResponse = await client.PostAsJsonAsync("/api/v1/suppliers", new
        {
            name = $"Critical Workflow Supplier {unique}", logo = "", type = "Distributor", status = "Active", tin = "",
            companyEmail = "supplier@example.com", companyPhone = "456", address = "Manila", catalogUrl = "",
            contacts = new[] { new { id = Guid.NewGuid(), name = "Sales", email = "sales@example.com", phone = "456" } },
            categories = Array.Empty<string>(), performanceNotes = Array.Empty<object>(),
        }, token);
        supplierResponse.EnsureSuccessStatusCode();
        var supplier = (await supplierResponse.Content.ReadFromJsonAsync<SupplierDto>(token))!;

        var itemResponse = await client.PostAsJsonAsync("/api/v1/items", new
        {
            supplierId = supplier.Id, name = $"Critical Workflow Item {unique}", photo = (string?)null,
            category = itemCategories!.First(value => value.IsActive).Name, subcategory = "", brand = "", unitOfMeasure = "Piece",
            unitWeight = 0, productCode = $"CW-{unique}"[..18], barcode = "", description = "", status = "Active",
            rawCost = 40m, sellingPrice = 100m, lastPriceUpdate = "2026-08-30",
        }, token);
        itemResponse.EnsureSuccessStatusCode();
        var item = (await itemResponse.Content.ReadFromJsonAsync<ItemDto>(token))!;

        var quotationResponse = await client.PostAsJsonAsync("/api/v1/quotations", new
        {
            quotationDate = "2026-08-30", clientId = savedClient.Id, clientName = "ignored", contactId,
            contactPerson = "ignored", subject = "Critical workflow", projectLocation = "Manila", leadTime = "7 days",
            notes = "", terms = "", vatEnabled = false, intent = "submit",
            lines = new[] { new { itemId = item.Id, variantId = (Guid?)null, photo = "", itemName = "ignored", variantLabel = "", productCode = "ignored", unitOfMeasure = "ignored", quantity = 2m, unitPrice = 100m, unitCost = 999m } },
            charges = Array.Empty<object>(),
        }, token);
        Assert.Equal(HttpStatusCode.Created, quotationResponse.StatusCode);
        var quotation = (await quotationResponse.Content.ReadFromJsonAsync<QuotationDto>(token))!;
        var approvalResponse = await client.PostAsJsonAsync($"/api/v1/quotations/{quotation.Id}/status", new { status = "Approved", reason = (string?)null, version = quotation.Version }, token);
        approvalResponse.EnsureSuccessStatusCode();
        var approvedQuotation = (await approvalResponse.Content.ReadFromJsonAsync<QuotationDto>(token))!;

        var purchaseOrderResponse = await client.PostAsJsonAsync("/api/v1/purchase-orders", new
        {
            orderDate = "2026-08-30", clientId = savedClient.Id, clientName = "ignored", supplierId = supplier.Id,
            supplierName = "ignored", contactPerson = "Sales", subject = "Critical workflow", quotationId = approvedQuotation.Id,
            paymentMethod, paymentTerm = "30 days", deliveryLocation = "Manila",
            deliveryMode = "Supplier delivery", notes = "", terms = "", vatEnabled = false, intent = "send",
            lines = new[] { new { itemId = item.Id, variantId = (Guid?)null, photo = "", itemName = "ignored", variantLabel = "", productCode = "ignored", unitOfMeasure = "ignored", quantity = 2m, unitCost = 999m } },
            charges = Array.Empty<object>(),
        }, token);
        Assert.Equal(HttpStatusCode.Created, purchaseOrderResponse.StatusCode);
        var purchaseOrder = (await purchaseOrderResponse.Content.ReadFromJsonAsync<PurchaseOrderDto>(token))!;
        Assert.Equal(approvedQuotation.Id, purchaseOrder.QuotationId);

        var expenseResponse = await client.PostAsync($"/api/v1/purchase-orders/{purchaseOrder.Id}/expense", null, token);
        expenseResponse.EnsureSuccessStatusCode();
        var expense = (await expenseResponse.Content.ReadFromJsonAsync<ExpenseDto>(token))!;
        Assert.Equal(purchaseOrder.Id, expense.PurchaseOrderId);
        Assert.Equal(approvedQuotation.Id, expense.QuotationId);

        var statementResponse = await client.PostAsJsonAsync("/api/v1/statements", new
        {
            statementDate = "2026-08-30", coverageFrom = "2026-08-01", coverageTo = "2026-08-31", dueDate = "2026-09-30",
            clientId = savedClient.Id, contactPerson = "Accounts", openingBalance = 0m, paymentArrangement = "Full payment",
            paymentFrequency = "Monthly", lateChargeEnabled = false, lateChargeGraceDays = 0, lateChargeType = "Fixed amount",
            lateChargeValue = 0m, notes = "", terms = "", quotationIds = new[] { approvedQuotation.Id },
            paymentSchedule = Array.Empty<object>(), intent = "draft",
        }, token);
        Assert.Equal(HttpStatusCode.Created, statementResponse.StatusCode);
        var statement = (await statementResponse.Content.ReadFromJsonAsync<StatementDto>(token))!;
        var issueResponse = await client.PostAsJsonAsync($"/api/v1/statements/{statement.Id}/status", new { status = "Issued", reason = (string?)null, version = statement.Version }, token);
        issueResponse.EnsureSuccessStatusCode();
        var issued = (await issueResponse.Content.ReadFromJsonAsync<StatementDto>(token))!;

        var paymentResponse = await client.PostAsJsonAsync($"/api/v1/statements/{issued.Id}/payments", new
        {
            paymentDate = "2026-08-30", amount = issued.Balance, method = paymentMethod,
            referenceNumber = $"CW-{unique[..8]}", notes = "Critical workflow settlement", idempotencyKey = $"critical-{unique}", version = issued.Version,
        }, token);
        paymentResponse.EnsureSuccessStatusCode();
        var settled = (await paymentResponse.Content.ReadFromJsonAsync<StatementDto>(token))!;

        Assert.Equal("Settled", settled.Status);
        Assert.Equal(0m, settled.Balance);
        Assert.Single(settled.Payments);
        Assert.Equal(approvedQuotation.Id, Assert.Single(settled.Quotations).QuotationId);
    }

    [Fact]
    public async Task Every_exposed_table_has_rls_and_the_runtime_role_cannot_bypass_it()
    {
        await using var factory = new OwnerApiFactory();
        var token = TestContext.Current.CancellationToken;
        var result = await factory.QueryInTestTransactionAsync(async connection =>
        {
            await using var command = connection.CreateCommand();
            command.CommandText = """
                select coalesce(array_agg(c.relname order by c.relname) filter (where not c.relrowsecurity), '{}'),
                       exists(select 1 from pg_roles where rolname='adiel_api_runtime' and not rolbypassrls and not rolsuper),
                       (select count(*) from pg_policies where schemaname='public' and policyname='API runtime access')
                from pg_class c join pg_namespace n on n.oid=c.relnamespace
                where n.nspname='public' and c.relkind in ('r','p')
                """;
            await using var reader = await command.ExecuteReaderAsync(token);
            await reader.ReadAsync(token);
            return (WithoutRls: reader.GetFieldValue<string[]>(0), SafeRole: reader.GetBoolean(1), PolicyCount: reader.GetInt64(2));
        }, token);

        Assert.Empty(result.WithoutRls);
        Assert.True(result.SafeRole, "Apply migration 20260830000000_production_api_role.sql before production verification.");
        Assert.True(result.PolicyCount >= 39, "Every API-accessed public table must have the role-specific runtime policy.");
    }
}
