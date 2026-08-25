using AdielSystem.Domain.Clients;

namespace AdielSystem.UnitTests.Clients;

public sealed class ClientTests
{
    [Fact]
    public void Create_normalizes_details_and_requires_one_primary_contact()
    {
        var contact = ClientContact.Create(Guid.NewGuid(), "  Jane Doe  ", "jane@example.com", "+63 900 000 0000", true, 0);
        var client = Client.Create(Guid.NewGuid(), "  Acme Corporation  ", null, "  Manila  ", "  Construction  ", new DateOnly(2026, 8, 24), ClientStatus.Active, [contact]);

        Assert.Equal("Acme Corporation", client.Name);
        Assert.Equal("Manila", client.Address);
        Assert.Equal("Jane Doe", client.Contacts.Single().Name);
        Assert.Equal(1, client.Version);
    }

    [Fact]
    public void Create_rejects_a_client_without_contacts()
    {
        var exception = Assert.Throws<ArgumentException>(() => Client.Create(Guid.NewGuid(), "Acme Corporation", null, "Manila", "Construction", new DateOnly(2026, 8, 24), ClientStatus.Active, []));
        Assert.Contains("At least one contact", exception.Message);
    }

    [Fact]
    public void Archived_client_cannot_be_edited_until_restored()
    {
        var contact = ClientContact.Create(Guid.NewGuid(), "Jane Doe", "jane@example.com", "+63 900 000 0000", true, 0);
        var client = Client.Create(Guid.NewGuid(), "Acme Corporation", null, "Manila", "Construction", new DateOnly(2026, 8, 24), ClientStatus.Active, [contact]);
        client.Archive(DateTimeOffset.UtcNow);

        Assert.Throws<InvalidOperationException>(() => client.Update("Acme Corporation", null, "Makati", "Construction", new DateOnly(2026, 8, 24), ClientStatus.Active, [contact]));
    }
}
