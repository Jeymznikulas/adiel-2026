using AdielSystem.Application.Common;
using AdielSystem.Application.Security;
using AdielSystem.Application.Settings;

namespace AdielSystem.UnitTests.Settings;

public sealed class SettingsServiceTests
{
    [Fact]
    public async Task Update_company_normalizes_values_and_requires_version()
    {
        var repository = new FakeSettingsRepository();
        var service = new SettingsService(repository, new FakeCurrentUser());
        var saved = await service.UpdateCompanyAsync(new("  ADIEL  ", "  Manila  ", "  123  ", "", "", "", " owner@example.com ", " 123-456 ", 4), TestContext.Current.CancellationToken);

        Assert.Equal("ADIEL", saved.CompanyName);
        Assert.Equal("Manila", saved.Address);
        Assert.Equal(5, saved.Version);
        Assert.Equal("owner", repository.LastActor?.Username);
    }

    [Fact]
    public async Task Enabled_percentage_late_charge_must_be_valid()
    {
        var service = new SettingsService(new FakeSettingsRepository(), new FakeCurrentUser());
        await Assert.ThrowsAsync<RequestValidationException>(() => service.UpdateDocumentDefaultsAsync(new("", "", "", "", true, 3, "Percentage", 0, 1), TestContext.Current.CancellationToken));
        await Assert.ThrowsAsync<RequestValidationException>(() => service.UpdateDocumentDefaultsAsync(new("", "", "", "", true, 3, "Percentage", 101, 1), TestContext.Current.CancellationToken));
    }

    [Fact]
    public async Task Unsupported_business_option_type_is_rejected()
    {
        var service = new SettingsService(new FakeSettingsRepository(), new FakeCurrentUser());
        await Assert.ThrowsAsync<RequestValidationException>(() => service.ListOptionsAsync("unknown", TestContext.Current.CancellationToken));
    }

    [Fact]
    public async Task Numbering_rules_are_normalized_and_require_unique_prefixes()
    {
        var repository = new FakeSettingsRepository();
        var service = new SettingsService(repository, new FakeCurrentUser());
        var saved = await service.UpdateDocumentNumberingRulesAsync(new([
            new("quotation", " qt ", 1, 3, true, true, 1),
            new("purchase_order", "po", 10, 4, true, true, 1),
            new("statement_of_account", "soa", 1, 3, false, false, 1),
        ]), TestContext.Current.CancellationToken);

        Assert.Equal("QT", saved.Single(rule => rule.DocumentType == "quotation").Prefix);
        Assert.Equal(2, saved.Single(rule => rule.DocumentType == "quotation").Version);

        await Assert.ThrowsAsync<RequestValidationException>(() => service.UpdateDocumentNumberingRulesAsync(new([
            new("quotation", "QT", 1, 3, true, true, 1),
            new("purchase_order", "QT", 1, 3, true, true, 1),
            new("statement_of_account", "SOA", 1, 3, true, true, 1),
        ]), TestContext.Current.CancellationToken));
    }

    [Fact]
    public async Task Reserve_number_uses_validated_type_date_and_actor()
    {
        var repository = new FakeSettingsRepository();
        var service = new SettingsService(repository, new FakeCurrentUser());
        var result = await service.ReserveDocumentNumberAsync("quotation", new(new DateOnly(2026, 8, 25)), TestContext.Current.CancellationToken);

        Assert.Equal("quotation", result.DocumentType);
        Assert.Equal("QT-2026-001", result.Number);
        Assert.Equal("owner", repository.LastActor?.Username);
    }

    [Fact]
    public async Task Yearly_numbering_reset_requires_the_year_in_the_format()
    {
        var service = new SettingsService(new FakeSettingsRepository(), new FakeCurrentUser());

        await Assert.ThrowsAsync<RequestValidationException>(() => service.UpdateDocumentNumberingRulesAsync(new([
            new("quotation", "QT", 1, 3, false, true, 1),
            new("purchase_order", "PO", 1, 3, true, true, 1),
            new("statement_of_account", "SOA", 1, 3, true, true, 1),
        ]), TestContext.Current.CancellationToken));
    }

    private sealed class FakeCurrentUser : ICurrentUserAccessor
    {
        public CurrentUser GetRequiredUser() => new(Guid.Parse("11111111-1111-1111-1111-111111111111"), "owner");
    }

    private sealed class FakeSettingsRepository : ISettingsRepository
    {
        public CurrentUser? LastActor { get; private set; }
        public Task<CompanySettings> GetCompanyAsync(CancellationToken cancellationToken) => Task.FromResult(new CompanySettings("ADIEL", "Manila", "123", "", "", "", "owner@example.com", "123", DateTimeOffset.UtcNow, 1));
        public Task<CompanySettings> UpdateCompanyAsync(CompanySettings settings, long expectedVersion, CurrentUser actor, CancellationToken cancellationToken) { LastActor = actor; return Task.FromResult(settings with { UpdatedAt = DateTimeOffset.UtcNow, Version = expectedVersion + 1 }); }
        public Task<DocumentDefaults> GetDocumentDefaultsAsync(CancellationToken cancellationToken) => Task.FromResult(new DocumentDefaults("", "", "", "", false, 3, "Percentage", 0, DateTimeOffset.UtcNow, 1));
        public Task<DocumentDefaults> UpdateDocumentDefaultsAsync(DocumentDefaults settings, long expectedVersion, CurrentUser actor, CancellationToken cancellationToken) => Task.FromResult(settings with { UpdatedAt = DateTimeOffset.UtcNow, Version = expectedVersion + 1 });
        public Task<IReadOnlyList<DocumentNumberingRule>> GetDocumentNumberingRulesAsync(CancellationToken cancellationToken) => Task.FromResult<IReadOnlyList<DocumentNumberingRule>>([
            new("quotation", "QT", 1, 3, true, true, DateTimeOffset.UtcNow, 1),
            new("purchase_order", "PO", 1, 3, true, true, DateTimeOffset.UtcNow, 1),
            new("statement_of_account", "SOA", 1, 3, true, true, DateTimeOffset.UtcNow, 1),
        ]);
        public Task<IReadOnlyList<DocumentNumberingRule>> UpdateDocumentNumberingRulesAsync(IReadOnlyList<DocumentNumberingRule> rules, CurrentUser actor, CancellationToken cancellationToken) { LastActor = actor; return Task.FromResult<IReadOnlyList<DocumentNumberingRule>>(rules.Select(rule => rule with { UpdatedAt = DateTimeOffset.UtcNow, Version = rule.Version + 1 }).ToArray()); }
        public Task<string> PreviewDocumentNumberAsync(string documentType, DateOnly documentDate, CancellationToken cancellationToken) => Task.FromResult("QT-2026-001");
        public Task<string> ReserveDocumentNumberAsync(string documentType, DateOnly documentDate, CurrentUser actor, CancellationToken cancellationToken) { LastActor = actor; return Task.FromResult("QT-2026-001"); }
        public Task<IReadOnlyList<BusinessOption>> ListOptionsAsync(string type, CancellationToken cancellationToken) => Task.FromResult<IReadOnlyList<BusinessOption>>([]);
        public Task<BusinessOption> CreateOptionAsync(string type, string name, CurrentUser actor, CancellationToken cancellationToken) => throw new NotImplementedException();
        public Task<BusinessOption> RenameOptionAsync(Guid id, string name, long expectedVersion, CurrentUser actor, CancellationToken cancellationToken) => throw new NotImplementedException();
        public Task<BusinessOption> SetOptionActiveAsync(Guid id, bool isActive, long expectedVersion, CurrentUser actor, CancellationToken cancellationToken) => throw new NotImplementedException();
        public Task<IReadOnlyList<BusinessOption>> ReorderOptionsAsync(string type, IReadOnlyList<ReorderBusinessOption> items, CurrentUser actor, CancellationToken cancellationToken) => throw new NotImplementedException();
        public Task DeleteOptionAsync(Guid id, long expectedVersion, CurrentUser actor, CancellationToken cancellationToken) => throw new NotImplementedException();
    }
}
