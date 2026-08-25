using AdielSystem.Domain.Items;

namespace AdielSystem.UnitTests.Items;

public sealed class ItemDomainTests
{
    [Fact]
    public void Item_rejects_a_base64_photo_and_negative_prices()
    {
        Assert.Throws<ArgumentException>(() => Item.Create(Guid.NewGuid(), null, "Cable", "data:image/png;base64,test", "Electrical", "", "", "Piece", 0, "TEST-1", "", "", ItemStatus.Active, 1, 2, DateOnly.FromDateTime(DateTime.UtcNow)));
        Assert.Throws<ArgumentException>(() => Item.Create(Guid.NewGuid(), null, "Cable", null, "Electrical", "", "", "Piece", 0, "TEST-2", "", "", ItemStatus.Active, -1, 2, DateOnly.FromDateTime(DateTime.UtcNow)));
    }
}
