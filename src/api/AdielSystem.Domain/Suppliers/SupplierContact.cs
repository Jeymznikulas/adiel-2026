namespace AdielSystem.Domain.Suppliers;

public sealed record SupplierContact(Guid Id, string Name, string Email, string Phone, bool IsPrimary, int SortOrder)
{
    public static SupplierContact Create(Guid id, string name, string email, string phone, bool isPrimary, int sortOrder)
    {
        if (id == Guid.Empty) throw new ArgumentException("A contact ID is required.", nameof(id));
        var normalizedName = Required(name, nameof(name), 200);
        var normalizedEmail = Required(email, nameof(email), 320);
        var normalizedPhone = Required(phone, nameof(phone), 50);
        if (!System.Net.Mail.MailAddress.TryCreate(normalizedEmail, out _)) throw new ArgumentException("A valid contact email is required.", nameof(email));
        if (sortOrder < 0) throw new ArgumentOutOfRangeException(nameof(sortOrder));
        return new SupplierContact(id, normalizedName, normalizedEmail, normalizedPhone, isPrimary, sortOrder);
    }

    private static string Required(string value, string parameterName, int maximumLength) { var normalized = value?.Trim() ?? string.Empty; if (normalized.Length == 0 || normalized.Length > maximumLength) throw new ArgumentException($"The value must be between 1 and {maximumLength} characters.", parameterName); return normalized; }
}

public sealed record SupplierPerformanceNote(Guid Id, string Text)
{
    public static SupplierPerformanceNote Create(Guid id, string text)
    {
        var normalized = text?.Trim() ?? string.Empty;
        if (normalized.Length is 0 or > 4000) throw new ArgumentException("Performance notes must be between 1 and 4000 characters.", nameof(text));
        return new SupplierPerformanceNote(id == Guid.Empty ? Guid.NewGuid() : id, normalized);
    }
}
