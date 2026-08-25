using System.Net.Mail;
using AdielSystem.Domain.Common;

namespace AdielSystem.Domain.Suppliers;

public sealed class Supplier : Entity
{
    private Supplier() { }

    public string Name { get; private set; } = string.Empty;
    public string? LogoPath { get; private set; }
    public SupplierType Type { get; private set; }
    public SupplierStatus Status { get; private set; }
    public string Tin { get; private set; } = string.Empty;
    public string CompanyEmail { get; private set; } = string.Empty;
    public string CompanyPhone { get; private set; } = string.Empty;
    public string Address { get; private set; } = string.Empty;
    public string? CatalogUrl { get; private set; }
    public IReadOnlyList<SupplierContact> Contacts { get; private set; } = [];
    public IReadOnlyList<string> Categories { get; private set; } = [];
    public IReadOnlyList<SupplierPerformanceNote> PerformanceNotes { get; private set; } = [];
    public DateTimeOffset CreatedAt { get; private set; }
    public DateTimeOffset UpdatedAt { get; private set; }
    public DateTimeOffset? ArchivedAt { get; private set; }
    public long Version { get; private set; }

    public static Supplier Create(Guid id, string name, string? logoPath, SupplierType type, SupplierStatus status, string tin, string companyEmail, string companyPhone, string address, string? catalogUrl, IEnumerable<SupplierContact> contacts, IEnumerable<string> categories, IEnumerable<SupplierPerformanceNote> performanceNotes)
    {
        var now = DateTimeOffset.UtcNow;
        var supplier = new Supplier { Id = id == Guid.Empty ? Guid.NewGuid() : id, CreatedAt = now, UpdatedAt = now, Version = 1 };
        supplier.SetDetails(name, logoPath, type, status, tin, companyEmail, companyPhone, address, catalogUrl, contacts, categories, performanceNotes);
        return supplier;
    }

    public static Supplier Rehydrate(Guid id, string name, string? logoPath, SupplierType type, SupplierStatus status, string tin, string companyEmail, string companyPhone, string address, string? catalogUrl, IEnumerable<SupplierContact> contacts, IEnumerable<string> categories, IEnumerable<SupplierPerformanceNote> performanceNotes, DateTimeOffset createdAt, DateTimeOffset updatedAt, DateTimeOffset? archivedAt, long version)
    {
        var supplier = new Supplier { Id = id, CreatedAt = createdAt, UpdatedAt = updatedAt, ArchivedAt = archivedAt, Version = version };
        supplier.SetDetails(name, logoPath, type, status, tin, companyEmail, companyPhone, address, catalogUrl, contacts, categories, performanceNotes);
        return supplier;
    }

    public void Update(string name, string? logoPath, SupplierType type, SupplierStatus status, string tin, string companyEmail, string companyPhone, string address, string? catalogUrl, IEnumerable<SupplierContact> contacts, IEnumerable<string> categories, IEnumerable<SupplierPerformanceNote> performanceNotes)
    {
        if (ArchivedAt is not null) throw new InvalidOperationException("An archived supplier must be restored before it can be edited.");
        SetDetails(name, logoPath, type, status, tin, companyEmail, companyPhone, address, catalogUrl, contacts, categories, performanceNotes);
    }

    public void Archive(DateTimeOffset occurredAt) => ArchivedAt ??= occurredAt;
    public void Restore() => ArchivedAt = null;

    private void SetDetails(string name, string? logoPath, SupplierType type, SupplierStatus status, string tin, string companyEmail, string companyPhone, string address, string? catalogUrl, IEnumerable<SupplierContact> contacts, IEnumerable<string> categories, IEnumerable<SupplierPerformanceNote> performanceNotes)
    {
        Name = Required(name, nameof(name), 200);
        LogoPath = OptionalPath(logoPath, nameof(logoPath), 500);
        Type = type;
        Status = status;
        Tin = Optional(tin, 60);
        CompanyEmail = RequiredEmail(companyEmail, nameof(companyEmail));
        CompanyPhone = Required(companyPhone, nameof(companyPhone), 60);
        Address = Optional(address, 1000);
        CatalogUrl = OptionalUrl(catalogUrl);
        var normalizedContacts = contacts.OrderBy(contact => contact.SortOrder).ToArray();
        if (normalizedContacts.Length == 0) throw new ArgumentException("At least one contact person is required.", nameof(contacts));
        if (normalizedContacts.Count(contact => contact.IsPrimary) != 1) throw new ArgumentException("Exactly one contact must be primary.", nameof(contacts));
        if (normalizedContacts.Select(contact => contact.Id).Distinct().Count() != normalizedContacts.Length) throw new ArgumentException("Contact IDs must be unique.", nameof(contacts));
        Contacts = normalizedContacts;
        Categories = categories.Select(category => Required(category, nameof(categories), 100)).Distinct(StringComparer.OrdinalIgnoreCase).OrderBy(category => category, StringComparer.OrdinalIgnoreCase).ToArray();
        PerformanceNotes = performanceNotes.ToArray();
    }

    private static string Required(string value, string parameterName, int maximumLength) { var normalized = value?.Trim() ?? string.Empty; if (normalized.Length == 0 || normalized.Length > maximumLength) throw new ArgumentException($"The value must be between 1 and {maximumLength} characters.", parameterName); return normalized; }
    private static string Optional(string? value, int maximumLength) { var normalized = value?.Trim() ?? string.Empty; if (normalized.Length > maximumLength) throw new ArgumentException($"The value cannot exceed {maximumLength} characters.", nameof(value)); return normalized; }
    private static string RequiredEmail(string value, string parameterName) { var normalized = Required(value, parameterName, 320); if (!MailAddress.TryCreate(normalized, out _)) throw new ArgumentException("A valid company email is required.", parameterName); return normalized; }
    private static string? OptionalPath(string? value, string parameterName, int maximumLength) { if (string.IsNullOrWhiteSpace(value)) return null; var normalized = value.Trim(); if (normalized.StartsWith("data:", StringComparison.OrdinalIgnoreCase)) throw new ArgumentException("Supplier logos must be uploaded to private storage.", parameterName); if (normalized.Length > maximumLength) throw new ArgumentException("The supplier logo path is too long.", parameterName); return normalized; }
    private static string? OptionalUrl(string? value) { if (string.IsNullOrWhiteSpace(value)) return null; var normalized = value.Trim(); if (!Uri.TryCreate(normalized, UriKind.Absolute, out var uri) || uri.Scheme is not ("http" or "https")) throw new ArgumentException("Catalog links must be valid HTTP or HTTPS URLs.", nameof(value)); return uri.AbsoluteUri; }
}

public enum SupplierType { Contractor, Distributor, Manufacturer, ServiceProvider, Other }
public enum SupplierStatus { Active, Inactive }
