# Manual photo checklist

Run on one real iPhone (iOS 17+) and one real Android phone, with a development build.

1. Open the dev screen: `npx uri-scheme open "matin://dev-photo" --ios` or `adb shell am start -a android.intent.action.VIEW -d "matin://dev-photo" com.matinwear.app`.
2. Take each photo below with the phone camera, then pick it with "Pick photo".
3. Fill in the result: cut-out OK or error code, hex and colour family, category, the first labels, and any crash or long delay.

A clean cut-out has the whole garment, no background patches and no missing parts. `ERR_NO_SUBJECT` is an acceptable result where noted; the app then offers Retake or Use anyway.

On Android, the first run after install can return `ERR_MODEL_DOWNLOADING` while Google Play services fetches the segmentation model. Wait and try again.

## iPhone

Device and iOS version:

| # | Photo | Expected | Result |
|---|-------|----------|--------|
| 1 | Dark room, garment on a chair | Cut-out of the garment, or `ERR_NO_SUBJECT`. No crash. | |
| 2 | Cluttered bed, one garment on top | Cut-out of the garment; other items may be included | |
| 3 | White shirt on a white wall | Cut-out or `ERR_NO_SUBJECT`. Colour family white if cut out. | |
| 4 | Black jeans on a dark floor | Cut-out; colour family black; category bottom | |
| 5 | Pair of shoes on the floor | Cut-out; category shoes | |
| 6 | Folded item (T-shirt or sweater) | Cut-out; category top or outerwear | |
| 7 | Garment on a hanger | Cut-out; hanger may be included | |
| 8 | Patterned shirt (checks or print) | Cut-out; colour is the main colour or multi; category top | |
| 9 | Dress, flat or on a hanger | Cut-out; category dress or top | |
| 10 | Jacket or coat | Cut-out; category outerwear | |

## Android

Device and Android version:

| # | Photo | Expected | Result |
|---|-------|----------|--------|
| 1 | Dark room, garment on a chair | Cut-out of the garment, or `ERR_NO_SUBJECT`. No crash. | |
| 2 | Cluttered bed, one garment on top | Cut-out of the garment; other items may be included | |
| 3 | White shirt on a white wall | Cut-out or `ERR_NO_SUBJECT`. Colour family white if cut out. | |
| 4 | Black jeans on a dark floor | Cut-out; colour family black; category bottom | |
| 5 | Pair of shoes on the floor | Cut-out; category shoes | |
| 6 | Folded item (T-shirt or sweater) | Cut-out; category top or outerwear | |
| 7 | Garment on a hanger | Cut-out; hanger may be included | |
| 8 | Patterned shirt (checks or print) | Cut-out; colour is the main colour or multi; category top | |
| 9 | Dress, flat or on a hanger | Cut-out; category dress or top | |
| 10 | Jacket or coat | Cut-out; category outerwear | |

## Also check

- A full-resolution camera photo (12 MP or more) does not crash and finishes in a few seconds.
- A photo of a blank wall returns `ERR_NO_SUBJECT` and does not crash.
- Portrait photos come out upright (EXIF rotation applied).
