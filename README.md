# Rorisang Lu Store

Redesigned online boutique for Rorisang Lu (African luxury fashion, Gaborone, Botswana).
This is a working demo: shop, product pages, bag, checkout, and an owner admin page for
managing the catalogue and product photos.

## Structure

| Path | What it holds |
| --- | --- |
| `index.html` | Page structure (markup only) |
| `css/styles.css` | All styling, light and dark themes |
| `js/app.js` | Storefront, bag, checkout and admin behaviour |
| `js/demo-store.js` | Browser-only storage so the admin works on a static host |

## Trying the demo

- Shop: browse, filter, pick a size, add to bag, check out.
- Admin: open `#admin` (for example `/#admin`) or use the "Manage catalogue" link in the footer.
  Import the sample pieces or start empty, then add products and photos.
  In the demo, changes are saved in your own browser only. Use "Reset the demo" to clear them.

## Prototype limits

- No real payments are taken. Card, EFT, Orange Money and payment-plan steps are placeholders.
- Orders are not stored yet.
- Bank details, WhatsApp, email, Instagram and the returns policy are placeholders.
- Product photos and prices are samples until the owner adds real ones.

## Next steps

1. Replace `js/demo-store.js` with a Supabase adapter (shared catalogue, photo storage, owner login).
2. Save orders and show them in the admin.
3. Connect PayPal sandbox, then live keys after testing.
