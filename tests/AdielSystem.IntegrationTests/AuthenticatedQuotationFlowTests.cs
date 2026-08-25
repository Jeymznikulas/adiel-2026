using System.Net;
using System.Net.Http.Json;
using AdielSystem.Application.Clients;
using AdielSystem.Application.Items;
using AdielSystem.Application.Quotations;
using AdielSystem.Application.Settings;

namespace AdielSystem.IntegrationTests;

public sealed class AuthenticatedQuotationFlowTests
{
    [Fact]
    public async Task Owner_can_create_calculated_quotation_approve_void_archive_and_restore()
    {
        await using var factory = new OwnerApiFactory();
        using var client = factory.CreateClient();
        var token = TestContext.Current.CancellationToken;
        var industries = await client.GetFromJsonAsync<ClientIndustryDto[]>("/api/v1/clients/industries", token);
        var itemCategories = await client.GetFromJsonAsync<BusinessOptionDto[]>("/api/v1/settings/options?type=item_category", token);
        var contactId = Guid.NewGuid();
        var clientCreate = await client.PostAsJsonAsync("/api/v1/clients", new { name = $"Quotation Client {Guid.NewGuid():N}", photo = (string?)null, address = "Test", industry = industries!.First(x => x.IsActive).Name, clientSince = "2026-08-25", status = "Active", contacts = new[] { new { id = contactId, name = "Owner", email = "quote@example.com", phone = "123" } } }, token);
        clientCreate.EnsureSuccessStatusCode();
        var savedClient = await clientCreate.Content.ReadFromJsonAsync<ClientDto>(token);
        var code = $"QT-{Guid.NewGuid():N}"[..18];
        var itemCreate = await client.PostAsJsonAsync("/api/v1/items", new { supplierId = (Guid?)null, name = "Quoted item", photo = (string?)null, category = itemCategories!.First(x => x.IsActive).Name, subcategory = "", brand = "", unitOfMeasure = "Piece", unitWeight = 0, productCode = code, barcode = "", description = "", status = "Active", rawCost = 40m, sellingPrice = 80m, lastPriceUpdate = "2026-08-25" }, token);
        itemCreate.EnsureSuccessStatusCode();
        var item = await itemCreate.Content.ReadFromJsonAsync<ItemDto>(token);

        var create = await client.PostAsJsonAsync("/api/v1/quotations", new { quotationDate = "2026-08-25", clientId = savedClient!.Id, clientName = "ignored", contactId, contactPerson = "ignored", subject = "Integration quote", projectLocation = "Manila", leadTime = "7 days", notes = "", terms = "", vatEnabled = true, intent = "submit", lines = new[] { new { itemId = item!.Id, variantId = (Guid?)null, photo = "tampered", itemName = "tampered", variantLabel = "", productCode = "tampered", unitOfMeasure = "Box", quantity = 2m, unitPrice = 100m, unitCost = 999m } }, charges = new[] { new { label = "Delivery", amount = 25m } } }, token);
        Assert.Equal(HttpStatusCode.Created, create.StatusCode);
        var quotation = await create.Content.ReadFromJsonAsync<QuotationDto>(token);
        Assert.NotNull(quotation);
        Assert.Equal("For Approval", quotation.Status);
        Assert.Equal(200m, quotation.SubtotalAmount);
        Assert.Equal(24m, quotation.VatAmount);
        Assert.Equal(249m, quotation.TotalAmount);
        Assert.Equal(120m, quotation.EstimatedProfit);
        Assert.Equal("Quoted item", quotation.Lines.Single().ItemName);
        Assert.Equal(40m, quotation.Lines.Single().UnitCost);

        var approve = await client.PostAsJsonAsync($"/api/v1/quotations/{quotation.Id}/status", new { status = "Approved", reason = (string?)null, version = quotation.Version }, token);
        approve.EnsureSuccessStatusCode(); var approved = await approve.Content.ReadFromJsonAsync<QuotationDto>(token);
        var voidResponse = await client.PostAsJsonAsync($"/api/v1/quotations/{quotation.Id}/status", new { status = "Voided", reason = "Test correction", version = approved!.Version }, token);
        voidResponse.EnsureSuccessStatusCode(); var voided = await voidResponse.Content.ReadFromJsonAsync<QuotationDto>(token);
        var archive = await client.PostAsJsonAsync($"/api/v1/quotations/{quotation.Id}/archive", new { version = voided!.Version }, token);
        archive.EnsureSuccessStatusCode(); var archived = await archive.Content.ReadFromJsonAsync<QuotationDto>(token); Assert.NotNull(archived!.ArchivedAt);
        var restore = await client.PostAsJsonAsync($"/api/v1/quotations/{quotation.Id}/restore", new { version = archived.Version }, token);
        restore.EnsureSuccessStatusCode(); Assert.Null((await restore.Content.ReadFromJsonAsync<QuotationDto>(token))!.ArchivedAt);
    }
}
