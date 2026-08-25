using System.Net;
using System.Net.Http.Json;
using AdielSystem.Application.Settings;

namespace AdielSystem.IntegrationTests;

public sealed class AuthenticatedSettingsTests
{
    [Fact]
    public async Task Owner_can_format_and_safely_reset_yearly_document_numbers_against_database()
    {
        await using var factory = new OwnerApiFactory();
        using var client = factory.CreateClient();
        var token = TestContext.Current.CancellationToken;
        var currentRules = await client.GetFromJsonAsync<DocumentNumberingRuleDto[]>("/api/v1/settings/numbering", token);
        Assert.NotNull(currentRules);

        var update = await client.PutAsJsonAsync("/api/v1/settings/numbering", new
        {
            rules = currentRules.Select(rule => new
            {
                documentType = rule.DocumentType,
                prefix = rule.Prefix,
                startingNumber = rule.DocumentType == "quotation" ? 1 : rule.StartingNumber,
                digits = rule.DocumentType == "quotation" ? 3 : rule.Digits,
                includeYear = rule.DocumentType == "quotation" || rule.IncludeYear,
                resetYearly = rule.DocumentType == "quotation" || rule.ResetYearly,
                version = rule.Version,
            }),
        }, token);
        update.EnsureSuccessStatusCode();

        var firstYear = await client.PostAsJsonAsync("/api/v1/settings/numbering/quotation/reserve", new { documentDate = "2098-01-01" }, token);
        var secondYear = await client.PostAsJsonAsync("/api/v1/settings/numbering/quotation/reserve", new { documentDate = "2099-01-01" }, token);
        firstYear.EnsureSuccessStatusCode();
        secondYear.EnsureSuccessStatusCode();
        var firstNumber = await firstYear.Content.ReadFromJsonAsync<DocumentNumberPreviewDto>(token);
        var secondNumber = await secondYear.Content.ReadFromJsonAsync<DocumentNumberPreviewDto>(token);

        Assert.NotNull(firstNumber);
        Assert.NotNull(secondNumber);
        Assert.Contains("-2098-", firstNumber.Number);
        Assert.Contains("-2099-", secondNumber.Number);
        Assert.EndsWith("-001", firstNumber.Number);
        Assert.EndsWith("-001", secondNumber.Number);
        // OwnerApiFactory rolls rule, sequence, and audit changes back on disposal.
    }

    [Fact]
    public async Task Owner_can_preview_and_reserve_distinct_document_numbers_against_database()
    {
        await using var factory = new OwnerApiFactory();
        using var client = factory.CreateClient();
        var token = TestContext.Current.CancellationToken;
        const string date = "2026-08-25";

        var rules = await client.GetFromJsonAsync<DocumentNumberingRuleDto[]>("/api/v1/settings/numbering", token);
        Assert.NotNull(rules);
        Assert.Equal(3, rules.Length);
        Assert.Contains(rules, rule => rule.DocumentType == "quotation");

        var preview = await client.GetFromJsonAsync<DocumentNumberPreviewDto>("/api/v1/settings/numbering/quotation/preview?documentDate=" + date, token);
        Assert.NotNull(preview);
        var reservations = new List<DocumentNumberPreviewDto?>();
        for (var index = 0; index < 5; index++)
        {
            var response = await client.PostAsJsonAsync("/api/v1/settings/numbering/quotation/reserve", new { documentDate = date }, token);
            response.EnsureSuccessStatusCode();
            reservations.Add(await response.Content.ReadFromJsonAsync<DocumentNumberPreviewDto>(token));
        }

        Assert.All(reservations, reservation => Assert.NotNull(reservation));
        Assert.Contains(reservations, reservation => reservation!.Number == preview.Number);
        Assert.Equal(reservations.Count, reservations.Select(reservation => reservation!.Number).Distinct(StringComparer.OrdinalIgnoreCase).Count());
        // OwnerApiFactory rolls reservation sequences and audit records back on disposal.
    }

    [Fact]
    public async Task Owner_can_update_settings_and_manage_options_with_audit_records_against_database()
    {
        await using var factory = new OwnerApiFactory();
        using var client = factory.CreateClient();
        var token = TestContext.Current.CancellationToken;
        var companyGet = await client.GetAsync("/api/v1/settings/company", token);
        Assert.True(companyGet.IsSuccessStatusCode, await companyGet.Content.ReadAsStringAsync(token));
        var originalCompany = await companyGet.Content.ReadFromJsonAsync<CompanySettingsDto>(token);
        var originalDocuments = await client.GetFromJsonAsync<DocumentDefaultsDto>("/api/v1/settings/documents", token);
        Assert.NotNull(originalCompany);
        Assert.NotNull(originalDocuments);
        var leakedTestOptions = await client.GetFromJsonAsync<BusinessOptionDto[]>("/api/v1/settings/options?type=expense_category", token);
        Assert.DoesNotContain(leakedTestOptions!, option => option.Name.StartsWith("Integration option ", StringComparison.Ordinal));
        var uniqueName = $"Integration option {Guid.NewGuid():N}";

        {
            var companyResponse = await client.PutAsJsonAsync("/api/v1/settings/company", new
            {
                companyName = string.IsNullOrWhiteSpace(originalCompany.CompanyName) ? "ADIEL" : originalCompany.CompanyName,
                address = string.IsNullOrWhiteSpace(originalCompany.Address) ? "Integration Test Address" : originalCompany.Address,
                mainOfficeNumber = string.IsNullOrWhiteSpace(originalCompany.MainOfficeNumber) ? "+63 900 000 0000" : originalCompany.MainOfficeNumber,
                clientRelationsNumber = originalCompany.ClientRelationsNumber,
                accountsNumber = originalCompany.AccountsNumber,
                newAccountsNumber = originalCompany.NewAccountsNumber,
                email = string.IsNullOrWhiteSpace(originalCompany.Email) ? "owner@example.com" : originalCompany.Email,
                tin = string.IsNullOrWhiteSpace(originalCompany.Tin) ? "000-000-000" : originalCompany.Tin,
                version = originalCompany.Version,
            }, token);
            companyResponse.EnsureSuccessStatusCode();

            var documentsResponse = await client.PutAsJsonAsync("/api/v1/settings/documents", new
            {
                quotationTerms = originalDocuments.QuotationTerms,
                purchaseOrderTerms = originalDocuments.PurchaseOrderTerms,
                statementPaymentInstructions = originalDocuments.StatementPaymentInstructions,
                pdfFooter = originalDocuments.PdfFooter,
                lateChargeEnabled = false,
                lateChargeGraceDays = originalDocuments.LateChargeGraceDays,
                lateChargeType = originalDocuments.LateChargeType,
                lateChargeValue = originalDocuments.LateChargeValue,
                version = originalDocuments.Version,
            }, token);
            documentsResponse.EnsureSuccessStatusCode();

            var create = await client.PostAsJsonAsync("/api/v1/settings/options", new { type = "expense_category", name = uniqueName }, token);
            Assert.Equal(HttpStatusCode.Created, create.StatusCode);
            var created = await create.Content.ReadFromJsonAsync<BusinessOptionDto>(token);
            Assert.NotNull(created);

            var rename = await client.PutAsJsonAsync($"/api/v1/settings/options/{created.Id}", new { name = $"{uniqueName} renamed", version = created.Version }, token);
            rename.EnsureSuccessStatusCode();
            var renamed = await rename.Content.ReadFromJsonAsync<BusinessOptionDto>(token);

            var deactivate = await client.PostAsJsonAsync($"/api/v1/settings/options/{renamed!.Id}/active", new { isActive = false, version = renamed.Version }, token);
            deactivate.EnsureSuccessStatusCode();
            var deactivated = await deactivate.Content.ReadFromJsonAsync<BusinessOptionDto>(token);
            Assert.NotNull(deactivated);

            var options = await client.GetFromJsonAsync<BusinessOptionDto[]>("/api/v1/settings/options?type=expense_category", token);
            Assert.Contains(options!, option => option.Id == deactivated.Id);

            var delete = await client.DeleteAsync($"/api/v1/settings/options/{deactivated.Id}?version={deactivated.Version}", token);
            Assert.Equal(HttpStatusCode.NoContent, delete.StatusCode);
            // Successful mutations prove their required Settings audit inserts also satisfied the database constraints.
        }
        // OwnerApiFactory rolls company, document, option, and audit changes back on disposal.
    }
}
