using System.Net;
using System.Net.Http.Json;
using AdielSystem.Application.Clients;
using AdielSystem.Application.Items;
using AdielSystem.Application.PurchaseOrders;
using AdielSystem.Application.Settings;
using AdielSystem.Application.Suppliers;
using AdielSystem.Application.Expenses;

namespace AdielSystem.IntegrationTests;

public sealed class AuthenticatedPurchaseOrderFlowTests
{
    [Fact]
    public async Task Owner_can_create_calculated_purchase_order_change_lifecycle_archive_and_restore()
    {
        await using var factory = new OwnerApiFactory(); using var client = factory.CreateClient(); var token = TestContext.Current.CancellationToken;
        var industries = await client.GetFromJsonAsync<ClientIndustryDto[]>("/api/v1/clients/industries", token);
        var categories = await client.GetFromJsonAsync<BusinessOptionDto[]>("/api/v1/settings/options?type=item_category", token);
        var contactId = Guid.NewGuid();
        var clientResponse = await client.PostAsJsonAsync("/api/v1/clients", new { name = $"PO Client {Guid.NewGuid():N}", photo = (string?)null, address = "Manila", industry = industries!.First(x => x.IsActive).Name, clientSince = "2026-08-25", status = "Active", contacts = new[] { new { id = contactId, name = "Buyer", email = "buyer@example.com", phone = "123" } } }, token);
        clientResponse.EnsureSuccessStatusCode(); var savedClient = await clientResponse.Content.ReadFromJsonAsync<ClientDto>(token);
        var supplierResponse = await client.PostAsJsonAsync("/api/v1/suppliers", new { name = $"PO Supplier {Guid.NewGuid():N}", logo = "", type = "Distributor", status = "Active", tin = "", companyEmail = "supplier@example.com", companyPhone = "456", address = "Manila", catalogUrl = "", contacts = new[] { new { id = Guid.NewGuid(), name = "Supplier contact", email = "supplier@example.com", phone = "456" } }, categories = Array.Empty<string>(), performanceNotes = Array.Empty<object>() }, token);
        supplierResponse.EnsureSuccessStatusCode(); var supplier = await supplierResponse.Content.ReadFromJsonAsync<SupplierDto>(token);
        var itemResponse = await client.PostAsJsonAsync("/api/v1/items", new { supplierId = supplier!.Id, name = "PO Item", photo = (string?)null, category = categories!.First(x => x.IsActive).Name, subcategory = "", brand = "", unitOfMeasure = "Piece", unitWeight = 0, productCode = $"PO-{Guid.NewGuid():N}"[..18], barcode = "", description = "", status = "Active", rawCost = 45m, sellingPrice = 90m, lastPriceUpdate = "2026-08-25" }, token);
        itemResponse.EnsureSuccessStatusCode(); var item = await itemResponse.Content.ReadFromJsonAsync<ItemDto>(token);
        var create = await client.PostAsJsonAsync("/api/v1/purchase-orders", new { orderDate = "2026-08-25", clientId = savedClient!.Id, clientName = "tampered", supplierId = supplier.Id, supplierName = "tampered", contactPerson = "Supplier contact", subject = "Materials", quotationId = (Guid?)null, paymentMethod = "Cash", paymentTerm = "30 days", deliveryLocation = "Manila", deliveryMode = "Supplier delivery", notes = "", terms = "", vatEnabled = true, intent = "send", lines = new[] { new { itemId = item!.Id, variantId = (Guid?)null, photo = "tampered", itemName = "tampered", variantLabel = "", productCode = "tampered", unitOfMeasure = "Box", quantity = 2m, unitCost = 999m } }, charges = new[] { new { label = "Delivery", amount = 20m } } }, token);
        Assert.Equal(HttpStatusCode.Created, create.StatusCode); var po = await create.Content.ReadFromJsonAsync<PurchaseOrderDto>(token); Assert.NotNull(po);
        Assert.Equal("Sent", po!.DocumentStatus); Assert.Equal(90m, po.SubtotalAmount); Assert.Equal(10.80m, po.VatAmount); Assert.Equal(120.80m, po.TotalAmount); Assert.Equal("PO Item", po.Lines.Single().ItemName); Assert.Equal(45m, po.Lines.Single().UnitCost);
        var generated = await client.PostAsync($"/api/v1/purchase-orders/{po.Id}/expense", null, token); generated.EnsureSuccessStatusCode(); var generatedExpense = await generated.Content.ReadFromJsonAsync<ExpenseDto>(token); Assert.Equal(po.Id, generatedExpense!.PurchaseOrderId); Assert.Equal(po.TotalAmount, generatedExpense.Amount);
        var generatedAgain = await client.PostAsync($"/api/v1/purchase-orders/{po.Id}/expense", null, token); generatedAgain.EnsureSuccessStatusCode(); Assert.Equal(generatedExpense.Id, (await generatedAgain.Content.ReadFromJsonAsync<ExpenseDto>(token))!.Id);
        var delivery = await client.PostAsJsonAsync($"/api/v1/purchase-orders/{po.Id}/status", new { documentStatus = (string?)null, deliveryStatus = "Delivered", paymentStatus = "To Pay", reason = (string?)null, version = po.Version }, token); delivery.EnsureSuccessStatusCode(); var changed = await delivery.Content.ReadFromJsonAsync<PurchaseOrderDto>(token); Assert.Equal("For Payment", changed!.Status);
        var voidResponse = await client.PostAsJsonAsync($"/api/v1/purchase-orders/{po.Id}/status", new { documentStatus = "Cancelled", deliveryStatus = (string?)null, paymentStatus = (string?)null, reason = "Correction", version = changed.Version }, token); voidResponse.EnsureSuccessStatusCode(); var cancelled = await voidResponse.Content.ReadFromJsonAsync<PurchaseOrderDto>(token);
        var archive = await client.PostAsJsonAsync($"/api/v1/purchase-orders/{po.Id}/archive", new { version = cancelled!.Version }, token); archive.EnsureSuccessStatusCode(); var archived = await archive.Content.ReadFromJsonAsync<PurchaseOrderDto>(token); Assert.NotNull(archived!.ArchivedAt);
        var restore = await client.PostAsJsonAsync($"/api/v1/purchase-orders/{po.Id}/restore", new { version = archived.Version }, token); restore.EnsureSuccessStatusCode(); Assert.Null((await restore.Content.ReadFromJsonAsync<PurchaseOrderDto>(token))!.ArchivedAt);
    }
}
