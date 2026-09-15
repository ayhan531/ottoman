final result: passed

Reference basis:
- Live emulator captures from the open Ottoman app.
- Provided screenshots in `C:\Users\Cem\Desktop\ottoman\görseller`.

Checked:
- Home market list, news list, portfolio, account, bottom navigation, and Al/Sat modal are implemented as interactive web screens.
- Local production build passes with `npm run build`.
- Headless Chrome render at mobile-sized viewport completed and produced `qa-home-wide.png` without blank output.

Notes:
- News thumbnails and stock logos are recreated as lightweight CSS approximations instead of remote/downsampled image assets.
