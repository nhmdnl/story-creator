import React, { useState } from 'react';
import { Handle, Position, useReactFlow } from '@xyflow/react';
import { Download, Loader2 } from 'lucide-react';
import jsPDF from 'jspdf';

export function ExportNode({ id, data }: any) {
  const [isExporting, setIsExporting] = useState(false);
  const { getNodes } = useReactFlow();

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const nodes = getNodes();
      const pageNodes = nodes.filter(n => n.type === 'page').sort((a, b) => a.position.y - b.position.y);
      
      if (pageNodes.length === 0) {
        alert("No pages found to export!");
        setIsExporting(false);
        return;
      }

      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'px',
        format: [800, 600]
      });

      for (let i = 0; i < pageNodes.length; i++) {
        const page = pageNodes[i];
        if (i > 0) {
          pdf.addPage();
        }
        
        // Add image
        if (Array.isArray(page.data.images) && page.data.images.length > 0) {
          const imgUrl = page.data.images[0];
          try {
            const img = new Image();
            img.crossOrigin = "Anonymous";
            await new Promise((resolve, reject) => {
              img.onload = resolve;
              img.onerror = reject;
              img.src = imgUrl;
            });
            
            // Draw image on left half
            pdf.addImage(img, 'JPEG', 0, 0, 400, 600);
          } catch (err) {
            console.error("Failed to load image for PDF:", err);
          }
        }

        // Add text on right half
        pdf.setFontSize(16);
        const textLines = pdf.splitTextToSize(String(page.data.text || ''), 360);
        pdf.text(textLines, 420, 50);
      }

      pdf.save('storyflow-book.pdf');
    } catch (err) {
      console.error("Export failed:", err);
      alert("Failed to export PDF.");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-xl border border-stone-200 w-64 overflow-hidden">
      <Handle type="target" position={Position.Left} className="w-3 h-3 bg-stone-400" />
      
      <div className="bg-stone-900 p-4 text-white flex items-center justify-between">
        <h3 className="font-serif font-medium">Export Book</h3>
        <Download className="w-4 h-4 text-stone-400" />
      </div>

      <div className="p-4 flex flex-col gap-4">
        <p className="text-sm text-stone-500">
          Export your generated pages as a PDF book.
        </p>

        <button
          onClick={handleExport}
          disabled={isExporting}
          className="w-full bg-stone-900 text-white py-2 rounded-lg text-sm font-medium hover:bg-stone-800 disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {isExporting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Exporting...
            </>
          ) : (
            <>
              <Download className="w-4 h-4" />
              Download PDF
            </>
          )}
        </button>
      </div>
    </div>
  );
}
