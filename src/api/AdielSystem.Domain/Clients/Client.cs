using AdielSystem.Domain.Common;

namespace AdielSystem.Domain.Clients;

public sealed class Client : Entity
{
    private Client() { }

    public string Name { get; private set; } = string.Empty;
    public string? PhotoPath { get; private set; }
    public string Address { get; private set; } = string.Empty;
    public string Industry { get; private set; } = string.Empty;
    public DateOnly ClientSince { get; private set; }
    public ClientStatus Status { get; private set; }
    public IReadOnlyList<ClientContact> Contacts { get; private set; } = [];
    public DateTimeOffset CreatedAt { get; private set; }
    public DateTimeOffset UpdatedAt { get; private set; }
    public DateTimeOffset? ArchivedAt { get; private set; }
    public long Version { get; private set; }

    public static Client Create(Guid id, string name, string? photoPath, string address, string industry, DateOnly clientSince, ClientStatus status, IEnumerable<ClientContact> contacts)
    {
        var now = DateTimeOffset.UtcNow;
        var client = new Client { Id = id == Guid.Empty ? Guid.NewGuid() : id, CreatedAt = now, UpdatedAt = now, Version = 1 };
        client.SetDetails(name, photoPath, address, industry, clientSince, status, contacts);
        return client;
    }

    public static Client Rehydrate(Guid id, string name, string? photoPath, string address, string industry, DateOnly clientSince, ClientStatus status, IEnumerable<ClientContact> contacts, DateTimeOffset createdAt, DateTimeOffset updatedAt, DateTimeOffset? archivedAt, long version)
    {
        var client = new Client { Id = id, CreatedAt = createdAt, UpdatedAt = updatedAt, ArchivedAt = archivedAt, Version = version };
        client.SetDetails(name, photoPath, address, industry, clientSince, status, contacts);
        return client;
    }

    public void Update(string name, string? photoPath, string address, string industry, DateOnly clientSince, ClientStatus status, IEnumerable<ClientContact> contacts)
    {
        if (ArchivedAt is not null) throw new InvalidOperationException("An archived client must be restored before it can be edited.");
        SetDetails(name, photoPath, address, industry, clientSince, status, contacts);
    }

    public void Archive(DateTimeOffset occurredAt) => ArchivedAt ??= occurredAt;
    public void Restore() => ArchivedAt = null;

    private void SetDetails(string name, string? photoPath, string address, string industry, DateOnly clientSince, ClientStatus status, IEnumerable<ClientContact> contacts)
    {
        Name = Required(name, nameof(name), 200);
        Address = Required(address, nameof(address), 1000);
        Industry = Required(industry, nameof(industry), 100);
        PhotoPath = NormalizePhotoPath(photoPath);
        ClientSince = clientSince;
        Status = status;

        var normalized = contacts.OrderBy(contact => contact.SortOrder).ToArray();
        if (normalized.Length == 0) throw new ArgumentException("At least one contact person is required.", nameof(contacts));
        if (normalized.Count(contact => contact.IsPrimary) != 1) throw new ArgumentException("Exactly one contact must be primary.", nameof(contacts));
        if (normalized.Select(contact => contact.Id).Distinct().Count() != normalized.Length) throw new ArgumentException("Contact IDs must be unique.", nameof(contacts));
        Contacts = normalized;
    }

    private static string Required(string value, string parameterName, int maximumLength)
    {
        var normalized = value.Trim();
        if (normalized.Length == 0 || normalized.Length > maximumLength) throw new ArgumentException($"The value must be between 1 and {maximumLength} characters.", parameterName);
        return normalized;
    }

    private static string? NormalizePhotoPath(string? value)
    {
        if (string.IsNullOrWhiteSpace(value)) return null;
        var normalized = value.Trim();
        if (normalized.StartsWith("data:", StringComparison.OrdinalIgnoreCase))
            throw new ArgumentException("Client photos must be uploaded to private storage.", nameof(value));
        if (normalized.Length > 500)
            throw new ArgumentException("The client photo path is too long.", nameof(value));
        return normalized;
    }
}
