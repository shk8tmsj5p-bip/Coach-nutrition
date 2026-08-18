export async function exportElementToPdf(element: HTMLElement, filename: string) {
  const [{ jsPDF }, html2canvas] = await Promise.all([import("jspdf"), import("html2canvas")]);
  const pages = [...element.querySelectorAll<HTMLElement>("[data-pdf-page]")];
  const targets = pages.length > 0 ? pages : [element];
  const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  const pageWidth = 210;
  const pageHeight = 297;

  for (let index = 0; index < targets.length; index += 1) {
    const canvas = await html2canvas.default(targets[index], {
      scale: 2,
      backgroundColor: "#F2F4F8",
      useCORS: true,
      width: targets[index].offsetWidth,
      height: targets[index].offsetHeight,
      windowWidth: Math.max(720, targets[index].scrollWidth),
      windowHeight: Math.max(targets[index].offsetHeight, 1),
    });

    if (index > 0) pdf.addPage();
    addCanvasToPdf(pdf, canvas, pageWidth, pageHeight);
  }

  pdf.save(filename);
}

function addCanvasToPdf(
  pdf: import("jspdf").jsPDF,
  canvas: HTMLCanvasElement,
  pageWidth: number,
  pageHeight: number,
) {
  const pageRatio = pageHeight / pageWidth;
  const canvasRatio = canvas.height / canvas.width;

  if (canvasRatio <= pageRatio + 0.02) {
    pdf.addImage(canvas.toDataURL("image/jpeg", 0.93), "JPEG", 0, 0, pageWidth, pageHeight);
    return;
  }

  const sliceHeightPx = Math.floor(canvas.width * pageRatio);
  let y = 0;
  let first = true;
  while (y < canvas.height - 4) {
    const h = Math.min(sliceHeightPx, canvas.height - y);
    const slice = document.createElement("canvas");
    slice.width = canvas.width;
    slice.height = h;
    const ctx = slice.getContext("2d");
    if (!ctx) break;
    ctx.fillStyle = "#F2F4F8";
    ctx.fillRect(0, 0, slice.width, slice.height);
    ctx.drawImage(canvas, 0, y, canvas.width, h, 0, 0, canvas.width, h);
    if (!first) pdf.addPage();
    first = false;
    const drawH = (h / canvas.width) * pageWidth;
    pdf.addImage(slice.toDataURL("image/jpeg", 0.93), "JPEG", 0, 0, pageWidth, Math.min(pageHeight, drawH));
    y += h;
  }
}
