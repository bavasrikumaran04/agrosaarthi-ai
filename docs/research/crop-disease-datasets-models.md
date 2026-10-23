# Crop-disease datasets, licences and a CPU-feasible training pipeline (AgroSaarthi AI)

Status: IN PROGRESS (started 2026-10-22)

Interim save #1 (PlantVillage verified). Sections 2, 4, 5, 6 are still being filled in.

## 1. Scope & method

- Question: which datasets/licences/backbones/OOD methods allow a reproducible, CPU-only (8 cores, 7.3 GB RAM, no GPU, ~50 GB disk, Python 3.14) training pipeline for a crop-disease image classifier that is served with FastAPI + onnxruntime, for Tamil Nadu farmers.
- Date of research: 2026-10-22. Everything below was checked on the live web on that date unless marked UNVERIFIED.
- Tools: WebFetch/WebSearch for pages; `curl` HEAD and HTTP Range requests for file sizes; the Mendeley public API JSON; the GitHub and Hugging Face (HF) public APIs.
- No dataset image was downloaded. Only metadata was read: (a) HEAD requests for size; (b) the ZIP central directory of the Mendeley "without augmentation" zip, fetched with 3 HTTP Range requests (9.6 MB of an 868 MB file) to list file names and per-class counts; (c) the small HF/GitHub text files `splits/color_train.txt`, `splits/color_test.txt` (4.2 MB and 1.0 MB) and `leaf_grouping/leaf-map.json` (2.4 MB) and the loader script `plant_village.py`.
- Numbers marked "(analyst-computed)" were computed locally from those metadata files by the analyst; they are reproducible with the method given.
- Evidence labels: verified-primary = read on the owner's official page/API; verified-secondary = read on a mirror/aggregator; UNVERIFIED = could not be confirmed.

## 2. Options compared (table)

(pending)

## 3. Findings per option with citations

### 3.1 PlantVillage (Hughes & Salathe 2015)

**Origin.** Hughes D.P. & Salathe M., "An open access repository of images on plant health to enable the development of mobile disease diagnostics through machine learning and crowdsourcing", arXiv:1511.08060, submitted 25 Nov 2015, revised 12 Apr 2016; announces "over 50,000 expertly curated images on healthy and infected leaves of crops plants through the existing online platform PlantVillage". Source: https://arxiv.org/abs/1511.08060 . The 54,306-image / 14-crop / 26-disease benchmark version is the one used by Mohanty, Hughes, Salathe, "Using Deep Learning for Image-Based Plant Disease Detection", Front. Plant Sci. 7:1419 (2016), doi 10.3389/fpls.2016.01419 (per https://github.com/spMohanty/PlantVillage-Dataset README).

**Image licence: the originators' own statement is CC BY-SA 3.0 WITH a share-alike clause on trained algorithms; the official site now says it can no longer offer the images; re-publications carry conflicting labels. Treat as NOT cleared for a proprietary commercial model.**

Primary statements (read first-hand):
- Hughes & Salathe 2015 (full text of https://arxiv.org/pdf/1511.08060, extracted with pdftotext): "Over 50,000 images of these are now stored on www.plantvillage.org, openly accessible and released under the Creative Commons Attribution-ShareAlike 3.0 Unported (CC BY-SA 3.0), with the clarification that algorithms trained on the data fall under the same license. We chose this license to ensure that any disease diagnostic algorithm developed on the data can be made freely available to anyone." So, by the authors' stated intent, a model trained on PlantVillage must itself be shareable under CC BY-SA 3.0 (attribution + share-alike, freely available). Whether that binds weights legally is UNVERIFIED legal question; the stated intent conflicts with keeping weights proprietary.
- Official PlantVillage page (https://plantvillage.psu.edu/topics/image-database/infos), verbatim: "Many people want to use PlantVillage images for projects (commercial and non-commercial). However, due to intellectual property issues we can no longer offer them to other groups." and "We will update this page if that changes" (post credited to "david"). So every public copy (Mendeley, HF, GitHub, TFDS, Kaggle) is a third-party re-publication and the owner says it is not offering the images; no replacement terms are given.
- The data paper gives the record count as 54,309 images (other sources: 54,306 GitHub README; 54,305 HF split and Mendeley zip, analyst-computed; 54,303 TFDS, probably because TFDS globs only `.JPG/.jpg` files, excluding the one `.png` and one `.jpeg` in the Mendeley zip; analyst inference).

| Where | What it says | Caveat |
|---|---|---|
| arXiv abs page of Hughes & Salathe | "License: Creative Commons BY-NC-SA 4.0" (https://arxiv.org/abs/1511.08060) | This is the licence shown for the paper record; arXiv does not state it covers the images. NC would block commercial use if it did. |
| GitHub spMohanty/PlantVillage-Dataset | No licence file; GitHub API `license: null`; README has no licence statement (https://api.github.com/repos/spMohanty/PlantVillage-Dataset , README raw) | "Open access" wording only. |
| HF `mohanty/PlantVillage` | Card metadata `license: cc-by-sa-3.0` (https://huggingface.co/datasets/mohanty/PlantVillage) | The loader source says `_LICENSE = "CC BY-SA 3.0"  # Assuming generic open license, verify if possible` (https://huggingface.co/datasets/mohanty/PlantVillage/raw/main/plant_village.py) - i.e. an assumption by the uploader, not a licence grant. |
| Mendeley Data tywbtsjrjv (re-publication by Arun Pandian J / Geetharamani Gopal, 2019-04-18) | `data_licence`: "CC0 1.0 Public Domain Dedication" (https://data.mendeley.com/public-api/datasets/tywbtsjrjv with header `Accept: application/vnd.mendeley-public-dataset.1+json`) | Licence set by a third party who re-uploaded PlantVillage images (linked article: doi 10.1016/j.compeleceng.2019.04.011); they may not hold rights to dedicate the images. |
| TensorFlow Datasets `plant_village` | Page footer says content is CC BY 4.0 (https://www.tensorflow.org/datasets/catalog/plant_village) | That is the generic documentation-site licence; the builder source has no image licence (https://raw.githubusercontent.com/tensorflow/datasets/master/tensorflow_datasets/datasets/plant_village/plant_village_dataset_builder.py). Do not cite it as a dataset licence. |

Practical reading: the HF label (cc-by-sa-3.0) matches the originators' statement even though the loader comment calls it an assumption; the Mendeley CC0 label contradicts it (a re-uploader cannot relicense someone else's images); the arXiv CC BY-NC-SA 4.0 line is the paper's licence. Research/prototyping use is common practice, but before a commercial AgroSaarthi release ships weights trained on PlantVillage, get written confirmation from the owners (Penn State PlantVillage / EPFL Digital Epidemiology Lab; contacts in the GitHub README: sharada.mohanty@epfl.ch, Marcel.Salathe@epfl.ch) and/or legal advice, or comply with CC BY-SA 3.0 (attribution + release the model under the same licence). Until then keep PlantVillage-trained weights private, prefer CC BY datasets for the production model (section 4), and record the status in the model card.

**How the images were taken (data paper, same PDF).** Images come from experimental research stations of US Land Grant Universities (Penn State, Florida State, Cornell and others). Leaves were removed from plants and placed on a paper sheet giving "a grey or black background", photographed outdoors in full light with a Sony DSC-RX100 (20.2 MP); "for each leaf, we typically took 4-7 images" while rotating the leaf through 360 degrees; for corn and squash "we took images of different sections of the same leaf"; images were then cropped to remove much of the background and "orientated ... so that they tip-pointed upwards". This confirms (a) uniform lab-like backgrounds, (b) several near-duplicate photos per physical leaf (so random splits leak), and (c) corn and squash leaves are split into sections, which are the classes missing from `leaf-map.json` (see issue 4 below).

**Field gap evidence.** Mohanty et al. 2016 (arXiv:1604.03169, https://arxiv.org/abs/1604.03169): 99.35% accuracy on a held-out test set from the same distribution, but only 31.4% (random 2.6%) on images "collected from trusted online sources - i.e. taken under conditions different from the images used for training". Noyan 2022 (below) found 49.0% from background pixels alone.

**Canonical 38-class list and per-class counts** (class names = HF label names; counts = analyst-computed from HF `splits/color_train.txt` + `color_test.txt`; they equal the per-folder counts of the Mendeley without-augmentation zip, whose folder names differ slightly, e.g. `Cherry___Powdery_mildew`). Total 54,305 images (train 43,596 / test 10,709 in the official HF split). The GitHub README says 54,306 and TFDS says 54,303, so quote "about 54.3k".

| # | Class | Total | Train | Test |
|---|---|---|---|---|
| 0 | Apple___Apple_scab | 630 | 503 | 127 |
| 1 | Apple___Black_rot | 621 | 475 | 146 |
| 2 | Apple___Cedar_apple_rust | 275 | 223 | 52 |
| 3 | Apple___healthy | 1645 | 1359 | 286 |
| 4 | Blueberry___healthy | 1502 | 1178 | 324 |
| 5 | Cherry_(including_sour)___Powdery_mildew | 1052 | 833 | 219 |
| 6 | Cherry_(including_sour)___healthy | 854 | 731 | 123 |
| 7 | Corn_(maize)___Cercospora_leaf_spot Gray_leaf_spot | 513 | 406 | 107 |
| 8 | Corn_(maize)___Common_rust_ | 1192 | 975 | 217 |
| 9 | Corn_(maize)___Northern_Leaf_Blight | 985 | 765 | 220 |
| 10 | Corn_(maize)___healthy | 1162 | 912 | 250 |
| 11 | Grape___Black_rot | 1180 | 1012 | 168 |
| 12 | Grape___Esca_(Black_Measles) | 1383 | 1099 | 284 |
| 13 | Grape___Leaf_blight_(Isariopsis_Leaf_Spot) | 1076 | 872 | 204 |
| 14 | Grape___healthy | 423 | 323 | 100 |
| 15 | Orange___Haunglongbing_(Citrus_greening) | 5507 | 4527 | 980 |
| 16 | Peach___Bacterial_spot | 2297 | 1755 | 542 |
| 17 | Peach___healthy | 360 | 289 | 71 |
| 18 | Pepper,_bell___Bacterial_spot | 997 | 831 | 166 |
| 19 | Pepper,_bell___healthy | 1478 | 1195 | 283 |
| 20 | Potato___Early_blight | 1000 | 836 | 164 |
| 21 | Potato___Late_blight | 1000 | 788 | 212 |
| 22 | Potato___healthy | 152 | 120 | 32 |
| 23 | Raspberry___healthy | 371 | 209 | 162 |
| 24 | Soybean___healthy | 5090 | 4117 | 973 |
| 25 | Squash___Powdery_mildew | 1835 | 1457 | 378 |
| 26 | Strawberry___Leaf_scorch | 1109 | 909 | 200 |
| 27 | Strawberry___healthy | 456 | 376 | 80 |
| 28 | Tomato___Bacterial_spot | 2127 | 1691 | 436 |
| 29 | Tomato___Early_blight | 1000 | 785 | 215 |
| 30 | Tomato___Late_blight | 1909 | 1534 | 375 |
| 31 | Tomato___Leaf_Mold | 952 | 780 | 172 |
| 32 | Tomato___Septoria_leaf_spot | 1771 | 1434 | 337 |
| 33 | Tomato___Spider_mites Two-spotted_spider_mite | 1676 | 1356 | 320 |
| 34 | Tomato___Target_Spot | 1404 | 1116 | 288 |
| 35 | Tomato___Tomato_Yellow_Leaf_Curl_Virus | 5357 | 4257 | 1100 |
| 36 | Tomato___Tomato_mosaic_virus | 373 | 307 | 66 |
| 37 | Tomato___healthy | 1591 | 1261 | 330 |

Imbalance: largest class 5,507 (Orange HLB), smallest 152 (Potato healthy) = 36:1. The Mendeley zip adds a 39th folder `Background_without_leaves` with 1,143 images (useful as an explicit background/reject class). Sources: https://huggingface.co/datasets/mohanty/PlantVillage (label list, split sizes), https://huggingface.co/datasets/mohanty/PlantVillage/resolve/main/splits/color_train.txt and .../color_test.txt (per-class counts), Mendeley zip central directory (per-folder counts).

**Direct downloads that need NO login (all checked 2026-10-22).**

| Source | URL | Size | Content | Licence label |
|---|---|---|---|---|
| Mendeley Data tywbtsjrjv v1, "without augmentation" zip (this exact file is what TFDS downloads) | https://data.mendeley.com/public-files/datasets/tywbtsjrjv/files/d5652a28-c1d8-4b76-97f3-72fb80f94efc/file_downloaded (HTTP 302 to a public S3 object, then 200, `Accept-Ranges: bytes`) | 868,032,562 bytes (827.8 MiB); SHA-256 ac3432453984d02a86197987e775a5429d0d59e7cc7c35bcf5a8f50349b90ff0 | 55,448 files = 54,305 images in 38 classes + 1,143 `Background_without_leaves`; 55,446 .jpg/.JPG, 1 .png, 1 .jpeg; every file is named `image (N).JPG` | CC0 1.0 (third-party assertion) |
| Mendeley Data tywbtsjrjv v1, "with augmentation" zip | https://data.mendeley.com/public-files/datasets/tywbtsjrjv/files/b4e3a32f-c0bd-4060-81e9-6144231f2520/file_downloaded | 949,267,727 bytes; SHA-256 cf8a16fbfe78df18b484de6012026b9db05fe795b24d2bad48f606758b020d75 | 61,486 images, 39 classes, six augmentations (flip, gamma, noise, PCA colour, rotation, scaling) per the Mendeley description. AVOID for training (augmented copies of the same photo leak across any random split). | CC0 1.0 (third-party assertion) |
| HF `mohanty/PlantVillage` `data.zip` | https://huggingface.co/datasets/mohanty/PlantVillage/resolve/main/data.zip | 2,184,723,441 bytes (2.03 GiB); contents beyond `raw/<type>/<class>/<file>` UNVERIFIED (loader expects color, grayscale, segmented) | Original file names kept; official split lists; `leaf_id` | tag cc-by-sa-3.0 (assumed by uploader) |
| HF split files and leaf map | https://huggingface.co/datasets/mohanty/PlantVillage/resolve/main/splits/color_train.txt (43,596 lines), .../color_test.txt (10,709 lines), .../leaf_grouping/leaf-map.json (2,429,879 bytes) | small | file lists + leaf grouping | as above |
| GitHub `spMohanty/PlantVillage-Dataset` | `git clone https://github.com/spMohanty/PlantVillage-Dataset` (default branch `master`, last push 2026-02-05) | repo size about 2.1 GB (GitHub API `size` 2,100,984 KB) | `raw/color`, `raw/grayscale`, `raw/segmented`, `leaf_grouping/` | none |
| TensorFlow Datasets `plant_village` v1.0.2 | `tfds.load("plant_village")` downloads the Mendeley file above | download 827.82 MiB, dataset 815.37 MiB | 54,303 examples, 38 classes, features `image`, `image/filename`, `label` | not stated in builder |

**Known issues and how they bite.**
1. Lab backgrounds / bias: Noyan (2022) trained a model on background pixels only and got 49.0% test accuracy vs 2.6% chance (https://arxiv.org/abs/2206.04374), so a classifier can score highly without looking at the lesion. Lab accuracy (>99% in papers) must not be quoted as field accuracy.
2. Several photos per physical leaf: the HF README states "Multiple images often capture the same physical leaf; separating them across train/test sets will bias your evaluation" and gives a `leaf_id`-grouped split recipe (https://huggingface.co/datasets/mohanty/PlantVillage). In the GitHub/HF file names (`<uuid>___<source name> <number>.JPG`, e.g. `00075aa8-d81a-4184-8541-b692b78d398a___FREC_Scab 3335.JPG`) the part after `___` is the original source image name; `leaf-map.json` maps lower-cased source names such as `rs_early.b 7557` to `<Class>:::<leaf number>` (e.g. `Potato___Early_blight:::115.0`).
3. The Mendeley zip loses this information: all names are `image (N).JPG`, so NO leaf/plant id can be derived from it.
4. Leaf grouping is incomplete even in the official HF data (analyst-computed by replicating the loader's `leaf_id` logic in `plant_village.py`): 13,194 of 54,305 images (24.3%) get a `fallback_<name>` id (i.e. each image is its own "leaf") because `leaf-map.json` has no entries for 7 classes (all 4 Corn classes, Grape___healthy, Squash___Powdery_mildew, Tomato___Target_Spot, Tomato___Tomato_mosaic_virus = 8 classes; `leaf-map.json` covers 31 of 38 classes) and half of Tomato___Late_blight (989/1909). For these classes a leaf-disjoint split is NOT guaranteed by the official files; add near-duplicate grouping (section 4).
5. Duplicates: 1,367 official-split file names contain the string "copy"; 2,792 source identifiers occur more than once (5,783 images) (analyst-computed). Run an exact-hash + perceptual-hash dedup before splitting.
6. Collection-site/prefix shortcuts: 50 distinct source-name prefixes (e.g. `RS_HL` 9,844 images, `CREC_HLB` 3,371, `UF.GRC_YLCV_Lab` 2,619) correlate with class (analyst-computed); the source prefix must not leak into features (and is a useful grouping key).
7. Mirrors with augmented duplicates (Kaggle "New Plant Diseases Dataset (Augmented)" etc.) were NOT checked in this session (Kaggle needs login); the only augmented mirror verified here is the Mendeley "with augmentation" zip.
8. Crop mismatch for Tamil Nadu: no rice, banana, cotton, groundnut or chilli classes; crops that do overlap with Tamil Nadu agriculture: tomato, potato, maize, grape, bell pepper (not chilli), citrus (HLB), soybean.

### 3.2 PlantDoc (field images, Cropped-PlantDoc classification set)

- Paper: Singh, Jain, Jain, Kayal, Kumawat, Batra, "PlantDoc: A Dataset for Visual Plant Disease Detection", CoDS-COMAD 2020, arXiv:1911.10317 (submitted 23 Nov 2019): 2,598 data points, 13 plant species, up to 17 disease classes, about 300 human hours annotating internet-scraped images. Source: https://arxiv.org/abs/1911.10317 and https://github.com/pratikkayal/PlantDoc-Dataset (README).
- Licence: CC BY 4.0. GitHub API reports `license.key = cc-by-4.0` and the README says "Creative Commons Attribution 4.0 International" with a `LICENSE.txt` (https://api.github.com/repos/pratikkayal/PlantDoc-Dataset). Caveat: the images were scraped from the internet, so the authors' CC BY grant cannot be assumed to clear the copyright of each original photo (UNVERIFIED rights per image). The arXiv page licence ("non-exclusive distribution") applies to the paper only.
- Download (no login): `git clone https://github.com/pratikkayal/PlantDoc-Dataset` (repo size 955,318 KB per GitHub API; last push 2021-05-02; default branch `master`). Image bytes sum to 997,022,815 (analyst-computed from the git tree, https://api.github.com/repos/pratikkayal/PlantDoc-Dataset/git/trees/master?recursive=1). The object-detection version is a separate repo linked from the README: https://github.com/pratikkayal/PlantDoc-Object-Detection-Dataset (not inspected).
- Split: the repo ships `train/` (2,342 images) and `test/` (236 images) folders, one sub-folder per class (analyst-computed from the git tree; 2,578 images in total plus one example PNG). The test set is tiny: 4-12 images per class, so per-class test metrics have very wide confidence intervals; report bootstrap CIs.
- Class folders (28; the paper says up to 17 disease classes) with train/test counts and the analyst's mapping by name to PlantVillage (PV) labels. The README gives no official mapping, so the three rows marked (?) are judgement calls.

| PlantDoc folder | train | test | PV label |
|---|---|---|---|
| Apple Scab Leaf | 83 | 10 | Apple___Apple_scab |
| Apple leaf | 82 | 9 | Apple___healthy |
| Apple rust leaf | 79 | 10 | Apple___Cedar_apple_rust |
| Bell_pepper leaf | 53 | 8 | Pepper,_bell___healthy |
| Bell_pepper leaf spot | 62 | 9 | Pepper,_bell___Bacterial_spot (?) |
| Blueberry leaf | 106 | 11 | Blueberry___healthy |
| Cherry leaf | 47 | 10 | Cherry_(including_sour)___healthy |
| Corn Gray leaf spot | 64 | 4 | Corn_(maize)___Cercospora_leaf_spot Gray_leaf_spot |
| Corn leaf blight | 180 | 12 | Corn_(maize)___Northern_Leaf_Blight (?) |
| Corn rust leaf | 106 | 10 | Corn_(maize)___Common_rust_ |
| Peach leaf | 103 | 9 | Peach___healthy |
| Potato leaf early blight | 109 | 8 | Potato___Early_blight |
| Potato leaf late blight | 97 | 8 | Potato___Late_blight |
| Raspberry leaf | 112 | 7 | Raspberry___healthy |
| Soyabean leaf | 57 | 8 | Soybean___healthy |
| Squash Powdery mildew leaf | 124 | 6 | Squash___Powdery_mildew |
| Strawberry leaf | 88 | 8 | Strawberry___healthy |
| Tomato Early blight leaf | 79 | 9 | Tomato___Early_blight |
| Tomato Septoria leaf spot | 140 | 11 | Tomato___Septoria_leaf_spot |
| Tomato leaf | 55 | 8 | Tomato___healthy |
| Tomato leaf bacterial spot | 101 | 9 | Tomato___Bacterial_spot |
| Tomato leaf late blight | 101 | 10 | Tomato___Late_blight |
| Tomato leaf mosaic virus | 44 | 10 | Tomato___Tomato_mosaic_virus |
| Tomato leaf yellow virus | 70 | 6 | Tomato___Tomato_Yellow_Leaf_Curl_Virus (?) |
| Tomato mold leaf | 85 | 6 | Tomato___Leaf_Mold |
| Tomato two spotted spider mites leaf | 2 | 0 | Tomato___Spider_mites Two-spotted_spider_mite (unusable: 2 train, 0 test) |
| grape leaf | 57 | 12 | Grape___healthy |
| grape leaf black rot | 56 | 8 | Grape___Black_rot |

- 28 PlantDoc folders map onto 28 of the 38 PV classes (27 with test images). PV classes with no PlantDoc counterpart (10): Apple___Black_rot, Cherry_(including_sour)___Powdery_mildew, Corn_(maize)___healthy, Grape___Esca_(Black_Measles), Grape___Leaf_blight_(Isariopsis_Leaf_Spot), Orange___Haunglongbing_(Citrus_greening), Peach___Bacterial_spot, Potato___healthy, Strawberry___Leaf_scorch, Tomato___Target_Spot. PlantDoc is too small to train on; use it as the separate field evaluation (and optionally a small fine-tuning/calibration set with a held-out part).

### 3.3 Indian-relevant datasets (permissive licences first)

All Mendeley licences below were read from the Mendeley public API field `data_licence` (call: `GET https://data.mendeley.com/public-api/datasets/<id>` with header `Accept: application/vnd.mendeley-public-dataset.1+json`, and a non-default User-Agent such as `curl/8.4.0`, because Python's default urllib User-Agent got HTTP 403 on file endpoints). All listed Mendeley items are CC BY 4.0 (commercial use allowed with attribution). File downloads use `https://data.mendeley.com/public-files/datasets/<id>/files/<file-id>/file_downloaded` (302 to a public storage object, supports Range).

| Crop | Dataset (Mendeley id, version) | Origin | Classes | Size | Download | Notes |
|---|---|---|---|---|---|---|
| Rice | Paddy Doctor (arXiv:2205.11108; IEEE DataPort DOI 10.21227/hz4v-af08; Kaggle competition `paddy-disease-classification` 10,407-image subset) | Village near Tirunelveli district, Tamil Nadu, smartphone (CAT S62 Pro), 1,080x1,440, Feb-Apr 2021, crop age 40-80 days | 13: BLB 648, BLS 505, BPB 450, BSB 506, Brown spot 2,351, Downy mildew 1,257, Leaf roller 868, Tungro 2,151, White stem borer 1,095, Yellow stem borer 1,951, Normal 1,273; Blast + Hispa = 3,170 together (individual counts not cleanly extracted from the PDF) | 16,225 images (cleaned from about 30,000) | Kaggle competition page and IEEE DataPort only; both normally need a login (UNVERIFIED) | NO licence statement on https://paddydoc.github.io/ or on the IEEE DataPort page (licence UNVERIFIED, treat as not cleared). The paper says variety and crop-age metadata exist (usable as grouping keys). Paper benchmark: ResNet34 F1 97.50% on a random 80/20 split (12,980/3,245), not leaf- or field-disjoint. The best match for Tamil Nadu rice. Variant sizes (about 4.7 GB originals, 1.24 GB 480x640, 323 MB 256x256) come only from a search-engine summary of the IEEE DataPort page: UNVERIFIED |
| Rice | Rice Leaf Disease Image Samples (`fwcj7stb8r`, v2, 2024-07-18, DOI 10.17632/fwcj7stb8r.2; Sethy et al. 2020) | Odisha, India (Sambalpur University) | 4: Bacterial blight, Blast, Brown spot, Tungro | 5,932 images | `Rice Leaf Disease Images.7z`, 179,355,409 bytes: https://data.mendeley.com/public-files/datasets/fwcj7stb8r/files/fd8717c4-0d65-4c80-a76c-3b61cb68e80d/file_downloaded | CC BY 4.0. The Paddy Doctor paper describes this set as 300x300 patches cropped from the diseased portion of professional-camera photos, so it is NOT a whole-leaf farmer-photo distribution. 7z needs `py7zr` or 7-Zip |
| Rice | Rice Leaf Bacterial and Fungal Disease Dataset (`hx6f852hw4`, v2) | Sirajganj/Pabna, Bangladesh | 8 (BLB, brown spot, leaf scald, narrow brown leaf spot, hispa, sheath blight, blast, healthy) | 1,701 originals | `Original Images.zip` 1,664,385,692 bytes; `Augmented Images.zip` 2,016,076,446 bytes (avoid) | CC BY 4.0; not India |
| Banana | Multi-Crop Disease Dataset (`6243z8r6t6`, v1, 2025-06-26, DOI 10.17632/6243z8r6t6.1) | Chengalpattu, Kanchipuram, Krishnagiri, Tamil Nadu (per description) | Banana, chilli, radish, groundnut, cauliflower, "more than 30 classes". Banana-like prefixes in file names: Yellow-and-Black-Sigatoka 2,792, Panama 1,121, Moko 440, Bract-Mosaic-Virus-Disease 399 (crop assignment of prefixes is analyst inference) | 21,875 jpg + 21,876 YOLO txt labels, 640x640, 967,494,637 bytes; 43,752 individual files, no archive | `GET https://data.mendeley.com/public-api/zip/6243z8r6t6/download/1` returned 302 to a presigned URL (HEAD of that URL gave 403; GET not tried): UNVERIFIED | CC BY 4.0. Roboflow export (`*_jpg.rf.<hash>.jpg`): 21,875 images share 20,248 distinct base names, so about 7% are augmented siblings that must be grouped before splitting. Bounding-box (detection) labels; classification label must be derived from the file-name prefix. PROVENANCE WARNING: the groundnut-like classes (Late-Leaf-Spot 1,984, Rust 1,724, Early-Leaf-Spot 1,707, Nutirtion-Deficiency 1,664, Early-Rust 1,471) have almost the same names and counts as the Koppal, Karnataka groundnut dataset below (Rust 1,724 vs 1,724; nutrition deficiency 1,665 vs 1,664; early rust 1,474 vs 1,471), so part of it may be a re-labelled copy of that dataset; the "Tamil Nadu" origin of those classes is UNVERIFIED. Deduplicate by image hash across datasets before use |
| Banana | BananaLSD (`9tb7k297ff`, v1, 2023-07-06, DOI 10.17632/9tb7k297ff.1) | BSMRAU and nearby fields, Bangladesh, smartphones, June 2021 | 4: Sigatoka, Cordana, Pestalotiopsis, Healthy | 937 raw + 1,600 augmented (2,537 files), 55,542,091 bytes | 2,537 individual files (no archive) | CC BY 4.0; labelled by a plant pathologist (per search summary of the PMC article https://www.ncbi.nlm.nih.gov/pmc/articles/PMC10562173/). Smaller 424-image Bangladesh set: `wfzpdmc5vx` (34 MB) |
| Cotton | Cotton Leaf Disease Dataset with Severity Levels (`74jsdxtmx2`, v3, 2025-03-10, DOI 10.17632/74jsdxtmx2.3) | Origin not stated in the API description (UNVERIFIED) | Cotton_Healthy, Bacterial_Blight, Fusarium_Wilt, Curl_Virus, further split by severity (mild/moderate/severe/critical) | `Cotton-Original.zip` 111,668,133 bytes (augmented zips 1.04 GB and 1.15 GB: avoid) | https://data.mendeley.com/public-files/datasets/74jsdxtmx2/files/3467319f-60ab-45b7-a016-9b3376cf0700/file_downloaded | CC BY 4.0 |
| Cotton | SAR-CLD-2024 (`b3jy2p6k8w`, v2, 2024-08-13) | National Cotton Research Institute fields, Gazipur, Bangladesh, Oct 2023-Jan 2024 (per search summary) | bacterial blight, curl virus, healthy, others (not enumerated) | 2,137 original + 7,000 augmented | `Original Dataset.zip` 270,591,498 bytes: https://data.mendeley.com/public-files/datasets/b3jy2p6k8w/files/9a365367-8a96-4c15-8bcc-a533ab79c7d6/file_downloaded | CC BY 4.0; not India |
| Cotton | Cotton Leaf Image Dataset for Disease Classification (`t9hgvk2h9p`, v1, 2025-06-30) | not stated | 5: Alternaria leaf spot, Bacterial blight, Fusarium wilt, Healthy, Verticillium wilt | `Cotton_Original_Dataset.zip` 60,910,234 bytes | https://data.mendeley.com/public-files/datasets/t9hgvk2h9p/files/a3bc3269-5c19-4394-824b-50be764a27c4/file_downloaded | CC BY 4.0 |
| Groundnut | A novel groundnut leaf dataset (`x6x5jkk873`, v2, 2024-02-13, DOI 10.17632/x6x5jkk873.2) | Ramchandrapur, Purba Medinipur, West Bengal, India | healthy, early + late leaf spot, Alternaria leaf spot, rust, rosette | 1,720 jpg, 4624x3472, 520,947,995 bytes | individual files (no archive) | CC BY 4.0 |
| Groundnut | Dataset of groundnut plant leaf images for classification and detection (`22p2vcbxfk`, v3, 2023-04-13; Data in Brief, PMC10293989) | Koppal area, Karnataka, India | healthy 1,871, early leaf spot 1,731, late leaf spot 1,896, nutrition deficiency 1,665, rust 1,724, early rust 1,474 (= 10,361 "processed images", per search summary of https://www.ncbi.nlm.nih.gov/pmc/articles/PMC10293989/) | Mendeley lists 3,060 files, 927,075,969 bytes; mismatch with 10,361 not resolved (UNVERIFIED) | individual files | CC BY 4.0 |
| Groundnut/mango | MGLeaf-Disease (`7m8n4ym4nm`, v2, 2026-06-18) | not checked | 9 classes, 91,438 images (v1) | 5.3 GB in 2 zips | 2.5 GB + 2.8 GB zips | CC BY 4.0; pre-split 70/15/15 in v1; probably heavily augmented (UNVERIFIED), skip |
| Chilli | Chili Leaf Diseases in the Krishna River Basin, Deccan Plateau, India (`ymt8k9bjkn`, v3, 2026-02-02) | Krishna River Basin, India | Bacterial spot, Curl virus, Cercospora leaf spot, Nutrition deficiency, White spot, Healthy | 1,856 original + 12,000 augmented (per search summary) | `Chili Leaf Disease Original Dataset.zip` 525,828,851 bytes: https://data.mendeley.com/public-files/datasets/ymt8k9bjkn/files/ca92fa24-b913-420c-b652-a40f7ba6fdda/file_downloaded ; augmented zip 4,773,222,633 bytes (avoid) | CC BY 4.0; the best-documented Indian chilli set found |
| Chilli | TCP (Tomato-Chilli-Papaya) (`m4m6j2tjfj`, v4, 2026-08-03) | MNIT Jaipur / Kota Agriculture University, Rajasthan | chilli: leaf curl, Cercospora, bacterial spot, white spot, nutrition deficiency, healthy (+ papaya, tomato) | 199,396,470-byte zip + 1,816,515,578-byte zip | on Mendeley | CC BY 4.0 |

Gaps: no verified Indian-origin cotton set, no Tamil-Nadu-verified banana set other than the doubtful Multi-Crop one, and the only Tamil Nadu rice set (Paddy Doctor) has no stated licence. Sugarcane, coconut, brinjal, okra, mango are not covered by any dataset checked here. Kaggle-hosted Indian sets were not evaluated (login-gated).

### 3.4 Backbones: licence terms and CPU throughput

**Licence of pretrained weights (two separate questions: the weight-file licence label, and the training-data terms).**
- Weight-file licence labels (HF model-card metadata read through https://huggingface.co/api/models/<id>, 2026-10-22): `timm/mobilenetv3_large_100.ra_in1k` apache-2.0; `timm/mobilenetv3_small_100.lamb_in1k` apache-2.0; `timm/efficientnet_b0.ra_in1k` apache-2.0; `timm/mobilenetv4_conv_medium.e500_r256_in1k` apache-2.0; `timm/tf_efficientnetv2_b0.in1k` apache-2.0; `timm/regnety_008.pycls_in1k` mit; `timm/mobilenetv3_large_100.miil_in21k_ft_in1k` apache-2.0 (datasets: imagenet-1k, imagenet-21k-p); `timm/vit_small_patch14_dinov2.lvd142m` apache-2.0; `facebook/dinov2-small` apache-2.0. The DINOv2 GitHub repo is Apache-2.0 (GitHub API) and its README says "DINOv2 code and model weights are released under the Apache License 2.0" (https://raw.githubusercontent.com/facebookresearch/dinov2/main/README.md; the same README also lists separate non-commercial licences for the X-ray-DINO and Cell-DINO models, which are NOT the ones to use). torchvision code is BSD-3-Clause (GitHub API https://api.github.com/repos/pytorch/vision).
- Training-data caveat (important for a commercial product): the timm README, "Licenses" section, says all its pretrained weights are trained on ImageNet "with a select few that have some additional pretraining", that "ImageNet was released for non-commercial research purposes only", that "it's not clear what the implications of that are for the use of pretrained weights", that "one should assume that the original dataset license applies to the weights", and "it's best to seek legal advice if you intend to use the pretrained weights in a commercial product" (https://raw.githubusercontent.com/huggingface/pytorch-image-models/main/README.md). The torchvision docs state: "The pre-trained models provided in this library may have their own licenses or terms and conditions derived from the dataset used for training. It is your responsibility to determine whether you have permission to use the models for your use case." (https://docs.pytorch.org/vision/stable/models.html). The primary ImageNet terms text could not be retrieved (image-net.org/download.php loads it dynamically behind a login): UNVERIFIED first-hand. DINOv2 was pretrained on the 142M-image LVD-142M set "without using any labels or annotations" (DINOv2 README); the licence status of those web images is not stated: UNVERIFIED.
- Consequence: "Apache-2.0" on a model card does not settle the ImageNet question. Record it in the model card and get legal sign-off before commercial release; licence-clean backbones (not trained on ImageNet) were not identified in this session.

**Accuracy, size, FLOPs (torchvision docs table, https://docs.pytorch.org/vision/stable/models.html) and CPU throughput (timm benchmark CSVs).**
CPU throughput source: Ross Wightman's published timm results, fp32, NCHW, PyTorch 2.4.0, batch size 1, `-dynamo` runs, on an Intel i7-12700H laptop CPU and an i9-10940X desktop CPU (https://raw.githubusercontent.com/huggingface/pytorch-image-models/main/results/benchmark-infer-fp32-nchw-pt240-cpu-i7_12700h-dynamo.csv and ...-cpu-i9_10940x-dynamo.csv). They were NOT measured on the project laptop (torch is not installed there; no benchmark was run), so treat them as an upper-ish bound for an 8-core laptop and measure with the script in section 5 before planning.

| Backbone (weights) | Params | Top-1 (torchvision) | GFLOPS (tv) | Weight file | img/s i7-12700H, 224 px, bs 1 | img/s i9-10940X, 224 px, bs 1 |
|---|---|---|---|---|---|---|
| MobileNetV3-Small | 2.5M | 67.668 | 0.06 | 10.2 MB (timm safetensors) | 374.1 | 249.8 |
| MobileNetV3-Large (tv V1 74.042 / V2 75.274; timm ra_in1k) | 5.5M | 74.042 / 75.274 | 0.22 | 22.1 MB | 135.1 | 176.3 |
| EfficientNet-B0 | 5.3M | 77.692 | 0.39 | 21.4 MB | 93.6 | 100.4 |
| MobileNetV4-Conv-Medium (timm, 256 px weights) | 9.8M | n/a here | n/a here | 39.2 MB | 84.5 | 115.1 |
| EfficientNetV2-B0 (tf) | 7.2M | n/a here | n/a here | 28.8 MB | 79.8 | 88.9 |
| RegNetY-800MF | 6.4M | 76.42 | 0.83 | 25.2 MB (timm, MIT) | 97.1 | 115.2 |
| ResNet-50 (reference) | 25.6M | 80.858 (V2) | 4.09 | n/a | 30.5 | 67.2 |
| ViT-S/16 (reference for ViT cost) | 22.1M | n/a | n/a | n/a | 26.7 | 76.5 |
| DINOv2 ViT-S/14 (`vit_small_patch14_dinov2.lvd142m`) | 22.06M | n/a (self-supervised) | n/a | 88.2 MB | 3.21 at 518 px (only size benchmarked) | 11.91 at 518 px |

DINOv2-S at 224 px is not in the CSV. Analyst estimate (NOT measured): 224 px uses 256 patch tokens vs 1,369 at 518 px, so roughly 4-6x faster than the 518-px figure, i.e. about 15-20 img/s on the i7-12700H-class CPU; the project laptop may be 0.5-1x of that.

### 3.5 Out-of-distribution (OOD) / abstention methods and image-quality gates

| Method | What it needs | Evidence read |
|---|---|---|
| Max softmax probability (MSP) | classifier logits only | Hendrycks & Gimpel, arXiv:1610.02136 (2016): "Correctly classified examples tend to have greater maximum softmax probabilities than erroneously classified and out-of-distribution examples" https://arxiv.org/abs/1610.02136 |
| Energy score | logits only | Liu et al., arXiv:2010.03759 (2020): "energy scores better distinguish in- and out-of-distribution samples than the traditional approach using the softmax scores" https://arxiv.org/abs/2010.03759 |
| Mahalanobis (and relative Mahalanobis) | class-conditional feature means + shared covariance | Lee et al., arXiv:1807.03888 (2018); Ren et al., arXiv:2106.09022 (2021) "relative Mahalanobis distance ... improves near-OOD detection" |
| kNN on embeddings | stored training embeddings, L2-normalised penultimate features | Sun et al., arXiv:2204.06507 (ICML 2022): score = distance to k-th nearest training neighbour of the L2-normalised feature; k = 50 for CIFAR-10, k = 200 for CIFAR-100, k = 1000 for ImageNet-1k; normalisation is essential in their ablation; "only 1% randomly sampled training data can yield a similar performance as using the full dataset"; Mahalanobis needs the covariance inverse "which can be numerically unstable" (text read from the PDF https://arxiv.org/pdf/2204.06507) |
| ViM (virtual logit matching) | logits + feature residual | Wang et al., arXiv:2203.10807 (2022) combines feature-space and logit-space scores |
| Explicit background / "not a crop leaf" class | labelled negatives | Outlier Exposure, Hendrycks et al., arXiv:1812.04606: train against an auxiliary outlier set. Mendeley PlantVillage zip provides 1,143 `Background_without_leaves` images |

Benchmark evidence: OpenOOD v1.5 (Zhang et al., JDMLR 2024, arXiv:2306.09301, https://arxiv.org/abs/2306.09301; text read from the PDF): "there is no single winner that always outperforms others across multiple data sets"; "data augmentations ... help with OOD detection in both standard and full-spectrum setting"; "the linear probe of self-supervised DINOv2 consistently and remarkably outperforms the fully-supervised counterpart, in all OOD detection cases and in ID classification" (ViT-B, ImageNet-1K); "Vision transformers do not outperform ResNets"; full-spectrum detection (semantic plus covariate shift together) "poses significant challenge for all current approaches". Consequence for AgroSaarthi: pick the abstention score empirically on our own OOD sets, do not trust a literature ranking.

**Image-quality checks**: (pending, see next save)

<!--S3-APPEND-->

## 4. Recommendation with trade-offs

(pending)

## 5. Implementation details an engineer needs WITHOUT web access

<!--S5-APPEND-->

## 6. Risks, limitations, open questions

<!--S6-APPEND-->

## 7. Sources (URL + what it supports)

- https://arxiv.org/abs/1511.08060 - PlantVillage origin (Hughes & Salathe 2015), "over 50,000" images, arXiv page licence CC BY-NC-SA 4.0.
- https://data.mendeley.com/public-api/datasets/tywbtsjrjv (Accept: application/vnd.mendeley-public-dataset.1+json) - Mendeley file ids, sizes, SHA-256, CC0 1.0 licence label, 39-class description, 61,486-image augmented count.
- https://data.mendeley.com/public-files/datasets/tywbtsjrjv/files/d5652a28-c1d8-4b76-97f3-72fb80f94efc/file_downloaded - HEAD: 868,032,562 bytes, Accept-Ranges bytes; central directory read: 55,448 files, per-folder counts, `image (N).JPG` names.
- https://github.com/spMohanty/PlantVillage-Dataset and https://raw.githubusercontent.com/spMohanty/PlantVillage-Dataset/master/README.md - 54,306 images/14 crops/26 diseases, layout, no licence statement, HF recommendation.
- https://api.github.com/repos/spMohanty/PlantVillage-Dataset (and /contents/leaf_grouping, /contents/raw/color/Apple___Apple_scab) - `license: null`, repo size, leaf_grouping files, example file names.
- https://huggingface.co/datasets/mohanty/PlantVillage (+ /raw/main/README.md, /api/datasets/mohanty/PlantVillage) - 38 labels, split sizes 43,596/10,709, `leaf_id` feature, licence tag cc-by-sa-3.0, leaf-grouped split recipe.
- https://huggingface.co/datasets/mohanty/PlantVillage/raw/main/plant_village.py - `_LICENSE` comment "Assuming generic open license, verify if possible"; `leaf_id` derivation logic.
- https://huggingface.co/datasets/mohanty/PlantVillage/resolve/main/data.zip - HEAD: 2,184,723,441 bytes.
- https://www.tensorflow.org/datasets/catalog/plant_village and https://raw.githubusercontent.com/tensorflow/datasets/master/tensorflow_datasets/datasets/plant_village/plant_village_dataset_builder.py - TFDS size 827.82 MiB, 54,303 examples, 38 classes, `_URL` = Mendeley file.
- https://arxiv.org/abs/2206.04374 - Noyan 2022, background-only model 49.0% vs 2.6% chance.
- https://github.com/pratikkayal/PlantDoc-Dataset (+ README raw, https://api.github.com/repos/pratikkayal/PlantDoc-Dataset, .../git/trees/master?recursive=1) - PlantDoc licence CC BY 4.0, repo size, train/test folders and per-class counts.
- https://arxiv.org/abs/1911.10317 - PlantDoc paper abstract (2,598 data points, 13 species, up to 17 classes, internet-scraped).
- https://arxiv.org/pdf/2205.11108 (text extracted locally with pdftotext) - Paddy Doctor class table, collection details (Tirunelveli, Feb-Apr 2021, CAT S62 Pro), 80/20 split, ResNet34 F1 97.50%, description of other rice datasets (Odisha set = 300x300 diseased patches).
- https://paddydoc.github.io/ - Paddy Doctor official site: Kaggle and IEEE DataPort links, no licence statement.
- https://ieee-dataport.org/node/10108 - Paddy Doctor IEEE DataPort record (DOI 10.21227/hz4v-af08), licence not shown.
- https://data.mendeley.com/public-api/datasets/{fwcj7stb8r, hx6f852hw4, 6243z8r6t6, 9tb7k297ff, wfzpdmc5vx, 74jsdxtmx2, b3jy2p6k8w, t9hgvk2h9p, x6x5jkk873, 22p2vcbxfk, 7m8n4ym4nm, ymt8k9bjkn, m4m6j2tjfj} - licences (CC BY 4.0), file names, sizes, download URLs, descriptions.
- https://data.mendeley.com/datasets/6243z8r6t6 and https://data.mendeley.com/datasets/ymt8k9bjkn/3 - dataset landing pages (found by web search; Tamil Nadu multi-crop set and Krishna-basin chilli set).
