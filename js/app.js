
const fileInput = document.getElementById("file-input");
const dropzone = document.getElementById("dropzone");
const chooseButton = document.getElementById("choose-button");

const uploadPlaceholder = document.getElementById("upload-placeholder");
const previewPanel = document.getElementById("preview-panel");
const imagePreview = document.getElementById("image-preview");

const fileName = document.getElementById("file-name");
const fileDetails = document.getElementById("file-details");
const removeButton = document.getElementById("remove-button");

const editorPanel = document.getElementById("editor-panel");
const editorCanvas = document.getElementById("editor-canvas");
const cropRatio = document.getElementById("crop-ratio");
const resetCropButton = document.getElementById("reset-crop");

const outputWidth = document.getElementById("output-width");
const outputHeight = document.getElementById("output-height");
const lockRatio = document.getElementById("lock-ratio");
const targetKB = document.getElementById("target-kb");
const outputFormat = document.getElementById("output-format");
const quality = document.getElementById("quality");
const qualityValue = document.getElementById("quality-value");

const processButton = document.getElementById("process-button");
const resetButton = document.getElementById("reset-editor");
const editorMessage = document.getElementById("editor-message");

const resultPanel = document.getElementById("result-panel");
const resultPreview = document.getElementById("result-preview");
const resultDimensions = document.getElementById("result-dimensions");
const resultSize = document.getElementById("result-size");
const resultFormat = document.getElementById("result-format");
const sizeResultNote = document.getElementById("size-result-note");
const downloadButton = document.getElementById("download-button");

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const MAX_DIMENSION = 8000;

const ALLOWED_TYPES = [
    "image/jpeg",
    "image/png",
    "image/webp"
];

let originalImage = null;
let currentFile = null;
let originalObjectUrl = null;
let resultObjectUrl = null;
let resultBlob = null;
let lastEditedDimension = "width";

// Freehand crop state
let cropRect = null;
let cropDrag = null;

function formatFileSize(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) {
        return `${(bytes / 1024).toFixed(1)} KB`;
    }
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function showMessage(message, isError = false) {
    editorMessage.textContent = message;
    editorMessage.classList.toggle("error", isError);
}



function getCropRatio() {
    const value = cropRatio.value;

    if (value === "original") {
        return originalImage.naturalWidth / originalImage.naturalHeight;
    }

    if (value === "custom") {
        return cropRect
            ? cropRect.width / cropRect.height
            : null;
    }

    const parts = value.split(":").map(Number);
    return parts[0] / parts[1];
}

function initializeCropRect() {
    if (!originalImage) return;

    const imageWidth = originalImage.naturalWidth;
    const imageHeight = originalImage.naturalHeight;

    if (cropRatio.value === "custom" && cropRect) {
        return;
    }

    if (cropRatio.value === "original" || cropRatio.value === "custom") {
        cropRect = {
            x: 0,
            y: 0,
            width: imageWidth,
            height: imageHeight
        };
        return;
    }

    const ratio = getCropRatio();

    let width = imageWidth;
    let height = width / ratio;

    if (height > imageHeight) {
        height = imageHeight;
        width = height * ratio;
    }

    cropRect = {
        x: (imageWidth - width) / 2,
        y: (imageHeight - height) / 2,
        width,
        height
    };
}


function getCropRectangle() {
    if (!cropRect) {
        initializeCropRect();
    }

    return {
        sx: cropRect.x,
        sy: cropRect.y,
        sw: cropRect.width,
        sh: cropRect.height
    };
}

function drawEditorPreview() {
    if (!originalImage || !cropRect) return;

    const imageWidth = originalImage.naturalWidth;
    const imageHeight = originalImage.naturalHeight;

    const previewScale = Math.min(
        1,
        900 / imageWidth,
        900 / imageHeight
    );

    editorCanvas.width = Math.max(1, Math.round(imageWidth * previewScale));
    editorCanvas.height = Math.max(1, Math.round(imageHeight * previewScale));

    const context = editorCanvas.getContext("2d");

    context.clearRect(0, 0, editorCanvas.width, editorCanvas.height);

    context.drawImage(
        originalImage,
        0,
        0,
        editorCanvas.width,
        editorCanvas.height
    );

    const scaleX = editorCanvas.width / imageWidth;
    const scaleY = editorCanvas.height / imageHeight;

    const x = cropRect.x * scaleX;
    const y = cropRect.y * scaleY;
    const width = cropRect.width * scaleX;
    const height = cropRect.height * scaleY;

    // Dark overlay outside the selected crop area
    context.fillStyle = "rgba(14, 11, 29, 0.65)";

    context.fillRect(0, 0, editorCanvas.width, y);
    context.fillRect(
        0,
        y + height,
        editorCanvas.width,
        editorCanvas.height - (y + height)
    );
    context.fillRect(0, y, x, height);
    context.fillRect(
        x + width,
        y,
        editorCanvas.width - (x + width),
        height
    );

    // Crop selection border
    context.strokeStyle = "#C9C2E3";
    context.lineWidth = Math.max(1.5, editorCanvas.width / 500);
    context.strokeRect(x, y, width, height);

    // Eight resize handles
    const handleSize = Math.max(7, editorCanvas.width / 100);

    const handles = [
        [x, y],
        [x + width / 2, y],
        [x + width, y],
        [x, y + height / 2],
        [x + width, y + height / 2],
        [x, y + height],
        [x + width / 2, y + height],
        [x + width, y + height]
    ];

    context.fillStyle = "#FFFFFF";
    context.strokeStyle = "#5A3B8C";
    context.lineWidth = 2;

    handles.forEach(([handleX, handleY]) => {
        context.beginPath();
        context.rect(
            handleX - handleSize / 2,
            handleY - handleSize / 2,
            handleSize,
            handleSize
        );
        context.fill();
        context.stroke();
    });
}



function getCropPointerPosition(event) {
    const bounds = editorCanvas.getBoundingClientRect();

    return {
        x: (event.clientX - bounds.left) *
            (originalImage.naturalWidth / bounds.width),
        y: (event.clientY - bounds.top) *
            (originalImage.naturalHeight / bounds.height)
    };
}

function getCropHandleAt(x, y) {
    const rect = cropRect;
    const bounds = editorCanvas.getBoundingClientRect();

    const tolerance = 14 *
        (originalImage.naturalWidth / bounds.width);

    const handles = {
        nw: [rect.x, rect.y],
        n: [rect.x + rect.width / 2, rect.y],
        ne: [rect.x + rect.width, rect.y],
        w: [rect.x, rect.y + rect.height / 2],
        e: [rect.x + rect.width, rect.y + rect.height / 2],
        sw: [rect.x, rect.y + rect.height],
        s: [rect.x + rect.width / 2, rect.y + rect.height],
        se: [rect.x + rect.width, rect.y + rect.height]
    };

    for (const [name, position] of Object.entries(handles)) {
        const distance = Math.hypot(
            x - position[0],
            y - position[1]
        );

        if (distance <= tolerance) {
            return name;
        }
    }

    return null;
}

function updateCropSelection(pointerX, pointerY) {
    if (!cropDrag || !originalImage) return;

    const imageWidth = originalImage.naturalWidth;
    const imageHeight = originalImage.naturalHeight;

    const start = cropDrag.startRect;
    const handle = cropDrag.handle;

    const deltaX = pointerX - cropDrag.startX;
    const deltaY = pointerY - cropDrag.startY;

    const minSize = Math.min(10, imageWidth, imageHeight);

    // Move the complete selection
    if (cropDrag.type === "move") {
        cropRect = {
            ...start,
            x: Math.max(
                0,
                Math.min(imageWidth - start.width, start.x + deltaX)
            ),
            y: Math.max(
                0,
                Math.min(imageHeight - start.height, start.y + deltaY)
            )
        };

        return;
    }

    // Custom mode: resize each edge independently
    if (cropRatio.value === "custom") {
        let left = start.x;
        let top = start.y;
        let right = start.x + start.width;
        let bottom = start.y + start.height;

        if (handle.includes("w")) {
            left = Math.max(
                0,
                Math.min(right - minSize, start.x + deltaX)
            );
        }

        if (handle.includes("e")) {
            right = Math.min(
                imageWidth,
                Math.max(left + minSize, start.x + start.width + deltaX)
            );
        }

        if (handle.includes("n")) {
            top = Math.max(
                0,
                Math.min(bottom - minSize, start.y + deltaY)
            );
        }

        if (handle.includes("s")) {
            bottom = Math.min(
                imageHeight,
                Math.max(top + minSize, start.y + start.height + deltaY)
            );
        }

        cropRect = {
            x: left,
            y: top,
            width: right - left,
            height: bottom - top
        };

        return;
    }

    // Fixed ratio mode: maintain the selected aspect ratio
    const ratio = getCropRatio();

    let width;
    let height;
    let x;
    let y;

    if (handle.length === 2) {
        const directionX = handle.includes("e") ? 1 : -1;
        const directionY = handle.includes("s") ? 1 : -1;

        const anchorX = directionX > 0
            ? start.x
            : start.x + start.width;

        const anchorY = directionY > 0
            ? start.y
            : start.y + start.height;

        const maxWidth = directionX > 0
            ? imageWidth - anchorX
            : anchorX;

        const maxHeight = directionY > 0
            ? imageHeight - anchorY
            : anchorY;

        const desiredWidth = Math.max(
            Math.abs(pointerX - anchorX),
            Math.abs(pointerY - anchorY) * ratio
        );

        width = Math.min(
            desiredWidth,
            maxWidth,
            maxHeight * ratio
        );

        width = Math.max(Math.min(minSize, maxWidth, maxHeight * ratio), width);
        height = width / ratio;

        x = directionX > 0 ? anchorX : anchorX - width;
        y = directionY > 0 ? anchorY : anchorY - height;

    } else if (handle === "e" || handle === "w") {
        const direction = handle === "e" ? 1 : -1;
        const centerY = start.y + start.height / 2;

        const anchorX = direction > 0
            ? start.x
            : start.x + start.width;

        const maxWidth = Math.min(
            direction > 0 ? imageWidth - anchorX : anchorX,
            2 * Math.min(centerY, imageHeight - centerY) * ratio
        );

        width = Math.min(
            Math.abs(pointerX - anchorX),
            maxWidth
        );

        width = Math.max(Math.min(minSize, maxWidth), width);
        height = width / ratio;

        x = direction > 0 ? anchorX : anchorX - width;
        y = centerY - height / 2;

    } else {
        const direction = handle === "s" ? 1 : -1;
        const centerX = start.x + start.width / 2;

        const anchorY = direction > 0
            ? start.y
            : start.y + start.height;

        const maxHeight = Math.min(
            direction > 0 ? imageHeight - anchorY : anchorY,
            2 * Math.min(centerX, imageWidth - centerX) / ratio
        );

        height = Math.min(
            Math.abs(pointerY - anchorY),
            maxHeight
        );

        height = Math.max(Math.min(minSize, maxHeight), height);
        width = height * ratio;

        x = centerX - width / 2;
        y = direction > 0 ? anchorY : anchorY - height;
    }

    cropRect = { x, y, width, height };
}

function handleCropPointerDown(event) {
    if (!originalImage || !cropRect) return;

    event.preventDefault();

    const position = getCropPointerPosition(event);
    const handle = getCropHandleAt(position.x, position.y);

    const insideCrop =
        position.x >= cropRect.x &&
        position.x <= cropRect.x + cropRect.width &&
        position.y >= cropRect.y &&
        position.y <= cropRect.y + cropRect.height;

    if (handle) {
        cropDrag = {
            type: "resize",
            handle,
            startX: position.x,
            startY: position.y,
            startRect: { ...cropRect }
        };
    } else if (insideCrop) {
        cropDrag = {
            type: "move",
            startX: position.x,
            startY: position.y,
            startRect: { ...cropRect }
        };
    } else {
        return;
    }

    editorCanvas.setPointerCapture(event.pointerId);
}

function handleCropPointerMove(event) {
    if (!cropDrag || !originalImage) return;

    event.preventDefault();

    const position = getCropPointerPosition(event);

    updateCropSelection(position.x, position.y);

    if (lockRatio.checked) {
        outputHeight.value = Math.max(
            1,
            Math.round(
                Number(outputWidth.value) /
                (cropRect.width / cropRect.height)
            )
        );
    }

    drawEditorPreview();
    clearResult();
}

function handleCropPointerUp(event) {
    if (!cropDrag) return;

    cropDrag = null;

    if (editorCanvas.hasPointerCapture(event.pointerId)) {
        editorCanvas.releasePointerCapture(event.pointerId);
    }
}

function resetCrop() {
    if (!originalImage) return;

    cropRect = null;
    cropDrag = null;

    initializeCropRect();

    updateDimensionsFromCrop();
}

function updateDimensionsFromCrop() {
    if (!originalImage) return;

    initializeCropRect();

    const ratio = cropRect.width / cropRect.height;
    const width = Number(outputWidth.value) || Math.round(cropRect.width);

    if (lockRatio.checked) {
        outputHeight.value = Math.max(1, Math.round(width / ratio));
    }

    drawEditorPreview();
    clearResult();
}


function clearResult() {
    if (resultObjectUrl) {
        URL.revokeObjectURL(resultObjectUrl);
        resultObjectUrl = null;
    }

    resultBlob = null;
    resultPreview.removeAttribute("src");
    resultPanel.hidden = true;
}


function resetEditor() {
    if (!originalImage) return;

    cropRatio.value = "original";
    cropRect = null;
    cropDrag = null;

    initializeCropRect();

    outputWidth.value = originalImage.naturalWidth;
    outputHeight.value = originalImage.naturalHeight;

    lockRatio.checked = true;
    targetKB.value = "";
    outputFormat.value = "image/jpeg";
    quality.value = 85;
    qualityValue.textContent = "85%";

    clearResult();
    showMessage("");
    drawEditorPreview();
}


function clearPreview() {
    if (originalObjectUrl) {
        URL.revokeObjectURL(originalObjectUrl);
        originalObjectUrl = null;
    }

    clearResult();

    currentFile = null;
    originalImage = null;
    cropRect = null;
    cropDrag = null;
    fileInput.value = "";

    imagePreview.removeAttribute("src");
    fileName.textContent = "";
    fileDetails.textContent = "";

    previewPanel.hidden = true;
    uploadPlaceholder.hidden = false;
    editorPanel.hidden = true;

    showMessage("");
}

function displayImage(file) {
    if (!file) return;

    if (!ALLOWED_TYPES.includes(file.type)) {
        alert("Please select a JPG, PNG or WEBP image.");
        return;
    }

    if (file.size > MAX_FILE_SIZE) {
        alert("Your image must be smaller than 10 MB.");
        return;
    }

    clearPreview();

    currentFile = file;
    originalObjectUrl = URL.createObjectURL(file);

    const image = new Image();

    image.onload = () => {
        if (image.naturalWidth > MAX_DIMENSION ||
            image.naturalHeight > MAX_DIMENSION) {
            clearPreview();
            alert("Image dimensions must not exceed 8000 × 8000 pixels.");
            return;
        }

        originalImage = image;

        initializeCropRect();

        imagePreview.src = originalObjectUrl;
        fileName.textContent = file.name;
        fileDetails.textContent =
            `${image.naturalWidth} × ${image.naturalHeight} px · ${formatFileSize(file.size)}`;

        outputWidth.value = Math.round(cropRect.width);
        outputHeight.value = Math.round(cropRect.height);

        uploadPlaceholder.hidden = true;
        previewPanel.hidden = false;
        editorPanel.hidden = false;

        drawEditorPreview();
        showMessage("Your image is ready to edit.");
        clearResult();
    };

    image.onerror = () => {
        clearPreview();
        alert("This image could not be opened. Please try another file.");
    };

    image.src = originalObjectUrl;
}

function getOutputDimensions() {
    const width = Number(outputWidth.value);
    const height = Number(outputHeight.value);

    if (!Number.isInteger(width) || !Number.isInteger(height) ||
        width < 1 || height < 1 ||
        width > MAX_DIMENSION || height > MAX_DIMENSION) {
        throw new Error("Width and height must be between 1 and 8000 pixels.");
    }

    return { width, height };
}

function canvasToBlob(canvas, mimeType, imageQuality) {
    return new Promise((resolve, reject) => {
        canvas.toBlob(
            (blob) => {
                if (blob) resolve(blob);
                else reject(new Error("Image could not be processed."));
            },
            mimeType,
            imageQuality
        );
    });
}


async function createOutputBlob(canvas, mimeType, selectedQuality, maxBytes) {
    let workingCanvas = canvas;

    // Without a target KB limit, use the selected quality.
    if (!maxBytes) {
        return {
            blob: await canvasToBlob(workingCanvas, mimeType, selectedQuality),
            width: workingCanvas.width,
            height: workingCanvas.height
        };
    }

    // PNG does not support the JPEG/WebP quality parameter.
    if (mimeType === "image/png") {
        return {
            blob: await canvasToBlob(workingCanvas, mimeType, selectedQuality),
            width: workingCanvas.width,
            height: workingCanvas.height
        };
    }

    // Try quality first, then reduce dimensions if necessary.
    for (let resizeAttempt = 0; resizeAttempt < 35; resizeAttempt++) {
        let low = 0.05;
        let high = selectedQuality;
        let bestBlob = null;

        // Check minimum quality first.
        const minimumBlob = await canvasToBlob(
            workingCanvas,
            mimeType,
            0.05
        );

        if (minimumBlob.size <= maxBytes) {
            bestBlob = minimumBlob;

            // Find the highest quality that fits the target.
            for (let i = 0; i < 14; i++) {
                const middle = (low + high) / 2;

                const blob = await canvasToBlob(
                    workingCanvas,
                    mimeType,
                    middle
                );

                if (blob.size <= maxBytes) {
                    bestBlob = blob;
                    low = middle;
                } else {
                    high = middle;
                }
            }

            return {
                blob: bestBlob,
                width: workingCanvas.width,
                height: workingCanvas.height
            };
        }

        // Target not reached: reduce dimensions by 10%.
        const nextWidth = Math.floor(workingCanvas.width * 0.90);
        const nextHeight = Math.floor(workingCanvas.height * 0.90);

        if (nextWidth < 1 || nextHeight < 1) break;

        const smallerCanvas = document.createElement("canvas");
        smallerCanvas.width = nextWidth;
        smallerCanvas.height = nextHeight;

        const context = smallerCanvas.getContext("2d");

        if (!context) {
            throw new Error("Could not resize the image.");
        }

        context.drawImage(
            workingCanvas,
            0,
            0,
            nextWidth,
            nextHeight
        );

        workingCanvas = smallerCanvas;
    }

    // Never report success if the requested maximum was not achieved.
    throw new Error(
        "This image cannot reach the selected KB limit. Try a higher KB limit."
    );
}


async function processImage() {
    if (!originalImage) {
        showMessage("Please upload an image first.", true);
        return;
    }

    try {
        clearResult();
        processButton.disabled = true;
        processButton.textContent = "Processing...";

        showMessage("Preparing your image...");

        const { width, height } = getOutputDimensions();
        const crop = getCropRectangle();
        const mimeType = outputFormat.value;
        const selectedQuality = Number(quality.value) / 100;

        const targetValue = Number(targetKB.value);
        const maxBytes = targetKB.value.trim() !== ""
            ? targetValue * 1024
            : null;

        if (targetKB.value.trim() !== "" &&
            (!Number.isFinite(targetValue) || targetValue < 1 || targetValue > 10240)) {
            throw new Error("Target size must be between 1 and 10240 KB.");
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;

        const context = canvas.getContext("2d");

        if (mimeType === "image/jpeg") {
            context.fillStyle = "#FFFFFF";
            context.fillRect(0, 0, width, height);
        }

        context.drawImage(
            originalImage,
            crop.sx,
            crop.sy,
            crop.sw,
            crop.sh,
            0,
            0,
            width,
            height
        );

        const output = await createOutputBlob(
            canvas,
            mimeType,
            selectedQuality,
            maxBytes
        );

        const blob = output.blob;

        resultBlob = blob;
        resultObjectUrl = URL.createObjectURL(blob);

        resultPreview.src = resultObjectUrl;
        resultDimensions.textContent =
            `${output.width} × ${output.height} px`;
        const originalKB = currentFile ? formatFileSize(currentFile.size) : "?";
        resultSize.textContent = `${formatFileSize(blob.size)} (was ${originalKB})`;
        resultFormat.textContent = blob.type.replace("image/", "").toUpperCase();

        if (maxBytes && blob.size > maxBytes) {
            sizeResultNote.textContent =
                "Target size could not be reached. Try smaller dimensions or JPG/WEBP.";
        } else if (maxBytes && mimeType === "image/png") {
            sizeResultNote.textContent =
                "PNG quality compression is not supported. Dimensions affect its file size.";
        } else if (maxBytes) {
            sizeResultNote.textContent =
                "✓ Your image is within the selected maximum file size.";
        } else {
            sizeResultNote.textContent =
                "Quality setting applied. No maximum file size was specified.";
        }

        resultPanel.hidden = false;
        showMessage("Image processed successfully. Check your result below.");

    } catch (error) {
        showMessage(error.message || "Something went wrong.", true);
    } finally {
        processButton.disabled = false;
        processButton.textContent = "Process image →";
    }
}

function downloadImage() {
    if (!resultBlob || !resultObjectUrl) {
        showMessage("Please process your image before downloading.", true);
        return;
    }

    const extension = resultBlob.type === "image/png"
        ? "png"
        : resultBlob.type === "image/webp"
            ? "webp"
            : "jpg";

    const link = document.createElement("a");
    link.href = resultObjectUrl;
    link.download = `formpix-image.${extension}`;

    document.body.appendChild(link);
    link.click();
    link.remove();
}

chooseButton.addEventListener("click", () => fileInput.click());

fileInput.addEventListener("change", (event) => {
    displayImage(event.target.files[0]);
});

removeButton.addEventListener("click", clearPreview);

["dragenter", "dragover"].forEach((eventName) => {
    dropzone.addEventListener(eventName, (event) => {
        event.preventDefault();
        dropzone.classList.add("dragover");
    });
});

["dragleave", "drop"].forEach((eventName) => {
    dropzone.addEventListener(eventName, (event) => {
        event.preventDefault();
        dropzone.classList.remove("dragover");
    });
});

dropzone.addEventListener("drop", (event) => {
    const file = event.dataTransfer.files[0];
    displayImage(file);
});

cropRatio.addEventListener("change", updateDimensionsFromCrop);

resetCropButton.addEventListener("click", resetCrop);

editorCanvas.addEventListener("pointerdown", handleCropPointerDown);
editorCanvas.addEventListener("pointermove", handleCropPointerMove);
editorCanvas.addEventListener("pointerup", handleCropPointerUp);
editorCanvas.addEventListener("pointercancel", handleCropPointerUp);

outputWidth.addEventListener("input", () => {
    lastEditedDimension = "width";

    if (lockRatio.checked && originalImage) {
        outputHeight.value = Math.max(
            1,
            Math.round(Number(outputWidth.value) / getCropRatio())
        );
    }

    clearResult();
});

outputHeight.addEventListener("input", () => {
    lastEditedDimension = "height";

    if (lockRatio.checked && originalImage) {
        outputWidth.value = Math.max(
            1,
            Math.round(Number(outputHeight.value) * getCropRatio())
        );
    }

    clearResult();
});

lockRatio.addEventListener("change", () => {
    if (lockRatio.checked && originalImage) {
        if (lastEditedDimension === "width") {
            outputHeight.value = Math.max(
                1,
                Math.round(Number(outputWidth.value) / getCropRatio())
            );
        } else {
            outputWidth.value = Math.max(
                1,
                Math.round(Number(outputHeight.value) * getCropRatio())
            );
        }
    }
    clearResult();
});

quality.addEventListener("input", () => {
    qualityValue.textContent = `${quality.value}%`;
    clearResult();
});

outputFormat.addEventListener("change", clearResult);
targetKB.addEventListener("input", clearResult);

processButton.addEventListener("click", processImage);
downloadButton.addEventListener("click", downloadImage);

// Copy to clipboard button
document.getElementById("copy-button").addEventListener("click", async () => {
    if (!resultBlob) return;
    try {
        // Clipboard mein PNG banana padta hai
        let blobToCopy = resultBlob;
        if (resultBlob.type !== "image/png") {
            // Convert to PNG for clipboard
            const img = new Image();
            img.src = resultObjectUrl;
            await new Promise(r => img.onload = r);
            const c = document.createElement("canvas");
            c.width = img.width; c.height = img.height;
            c.getContext("2d").drawImage(img, 0, 0);
            blobToCopy = await new Promise(r => c.toBlob(r, "image/png"));
        }
        await navigator.clipboard.write([
            new ClipboardItem({ "image/png": blobToCopy })
        ]);
        const btn = document.getElementById("copy-button");
        btn.textContent = "✓ Copied!";
        setTimeout(() => btn.textContent = "⧉ Copy", 2000);
    } catch {
        showMessage("Copy failed. Please download instead.", true);
    }
});
resetButton.addEventListener("click", resetEditor);

// Preset buttons — ek click mein sab auto-fill ho jata hai
document.querySelectorAll(".preset-btn").forEach(btn => {
    btn.addEventListener("click", () => {
        // Pehle sab active class hata do
        document.querySelectorAll(".preset-btn").forEach(b => b.classList.remove("active-preset"));
        btn.classList.add("active-preset");

        // Settings set karo
        outputWidth.value = btn.dataset.w;
        outputHeight.value = btn.dataset.h;
        targetKB.value = btn.dataset.kb;
        outputFormat.value = btn.dataset.fmt;
        if (btn.dataset.ratio && cropRatio) {
            cropRatio.value = btn.dataset.ratio;
            if (originalImage) updateDimensionsFromCrop();
        }
        qualityValue.textContent = "85%";
        quality.value = 85;
        clearResult();
    });
});

window.addEventListener("beforeunload", () => {
    if (originalObjectUrl) URL.revokeObjectURL(originalObjectUrl);
    if (resultObjectUrl) URL.revokeObjectURL(resultObjectUrl);
});
