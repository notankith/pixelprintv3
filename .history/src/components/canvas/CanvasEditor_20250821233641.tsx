import { useEffect, useRef, useState, useCallback, forwardRef, useImperativeHandle } from 'react';
import { Canvas as FabricCanvas, Text, Image, Rect } from 'fabric';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { Design, DesignElement } from '../StickerDesigner';
import { toast } from 'sonner';

interface CanvasEditorProps {
  design: Design;
  selectedElementId: string | null;
  onElementSelect: (elementId: string | null) => void;
  onElementUpdate: (elementId: string, updates: Partial<DesignElement>) => void;
  onElementDelete: (elementId: string) => void;
}
export type CanvasEditorHandle = {
  toDataURL: (opts?: { format?: string; multiplier?: number }) => string | null;
  exportImage: (filename?: string) => Promise<void>;
  exportPDF: (filename?: string) => Promise<void>;
  print: () => Promise<void>;
};

export const CanvasEditor = forwardRef<CanvasEditorHandle, CanvasEditorProps>(function CanvasEditor({
  design,
  selectedElementId,
  onElementSelect,
  onElementUpdate,
  onElementDelete
}: CanvasEditorProps, ref) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [fabricCanvas, setFabricCanvas] = useState<FabricCanvas | null>(null);
  const [zoom, setZoom] = useState(1);

  // Debug effect to track canvas state
  useEffect(() => {
    console.log('fabricCanvas state changed:', !!fabricCanvas);
  }, [fabricCanvas]);

  // Initialize canvas
  useEffect(() => {
    if (!canvasRef.current) {
      console.log('Canvas ref not available yet');
      return;
    }

    console.log('Initializing Fabric canvas...');
    const canvas = new FabricCanvas(canvasRef.current, {
      width: design.canvasWidth,
      height: design.canvasHeight,
      backgroundColor: '#ffffff',
      selection: true,
      preserveObjectStacking: true,
      allowTouchScrolling: false,
      imageSmoothingEnabled: false,
    });

    console.log('Fabric canvas created, setting state...');
    setFabricCanvas(canvas);

    return () => {
      console.log('Disposing Fabric canvas...');
      canvas.dispose();
    };
  }, [design.canvasWidth, design.canvasHeight]);

  // Handle object selection
  useEffect(() => {
    if (!fabricCanvas) return;

    const handleSelection = () => {
      const activeObject = fabricCanvas.getActiveObject();
      if (activeObject && (activeObject as any).elementId) {
        onElementSelect((activeObject as any).elementId);
      } else {
        onElementSelect(null);
      }
    };

    const handleDeselection = () => {
      onElementSelect(null);
    };

    fabricCanvas.on('selection:created', handleSelection);
    fabricCanvas.on('selection:updated', handleSelection);
    fabricCanvas.on('selection:cleared', handleDeselection);

    return () => {
      fabricCanvas.off('selection:created', handleSelection);
      fabricCanvas.off('selection:updated', handleSelection);
      fabricCanvas.off('selection:cleared', handleDeselection);
    };
  }, [fabricCanvas, onElementSelect]);

  // Handle object modifications
  useEffect(() => {
    if (!fabricCanvas) return;

    const handleObjectModified = () => {
      const activeObject = fabricCanvas.getActiveObject();
      if (activeObject && (activeObject as any).elementId) {
        const elementId = (activeObject as any).elementId;
        onElementUpdate(elementId, {
          x: activeObject.left || 0,
          y: activeObject.top || 0,
          width: (activeObject.width || 0) * (activeObject.scaleX || 1),
          height: (activeObject.height || 0) * (activeObject.scaleY || 1),
          rotation: activeObject.angle || 0,
        });
      }
    };

    fabricCanvas.on('object:modified', handleObjectModified);

    return () => {
      fabricCanvas.off('object:modified', handleObjectModified);
    };
  }, [fabricCanvas, onElementUpdate]);

  // Handle keyboard events for deletion
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedElementId) {
        onElementDelete(selectedElementId);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [selectedElementId, onElementDelete]);

  // Sync design elements with canvas
  useEffect(() => {
    if (!fabricCanvas) return;

    fabricCanvas.clear();

    design.elements.forEach(element => {
      let fabricObject: any;

      switch (element.type) {
        case 'text':
          fabricObject = new Text(element.properties.text || 'Text', {
            left: element.x,
            top: element.y,
            fontSize: element.properties.fontSize || 16,
            fontFamily: element.properties.fontFamily || 'Arial',
            fill: element.properties.color || '#000000',
            fontWeight: element.properties.bold ? 'bold' : 'normal',
            fontStyle: element.properties.italic ? 'italic' : 'normal',
            textAlign: element.properties.alignment || 'left',
            angle: element.rotation,
          });
          break;

        case 'image':
          if (element.properties.url) {
            console.log('Loading image:', element.properties.url);
            
            // Create a promise to handle image loading with better error handling
            const loadImage = async () => {
              try {
                // Try loading with CORS first
                const img = await Image.fromURL(element.properties.url, {
                  crossOrigin: 'anonymous'
                } as any);
                
                console.log('Image loaded successfully with CORS');
                return img;
              } catch (corsError) {
                console.log('CORS failed, trying without CORS:', corsError);
                
                try {
                  // Fallback: try without CORS
                  const img = await Image.fromURL(element.properties.url);
                  console.log('Image loaded successfully without CORS');
                  return img;
                } catch (fallbackError) {
                  console.error('Both CORS and non-CORS loading failed:', fallbackError);
                  throw fallbackError;
                }
              }
            };

            loadImage()
              .then(img => {
                img.set({
                  left: element.x,
                  top: element.y,
                  scaleX: element.width / (img.width || 1),
                  scaleY: element.height / (img.height || 1),
                  angle: element.rotation,
                });
                (img as any).elementId = element.id;
                fabricCanvas.add(img);
                fabricCanvas.renderAll();
                console.log('Image added to canvas successfully');
                toast.success('Image loaded successfully');
              })
              .catch((error) => {
                console.error('Failed to load image:', error);
                
                // Create a placeholder rectangle for failed images
                const placeholder = new Rect({
                  left: element.x,
                  top: element.y,
                  width: element.width,
                  height: element.height,
                  fill: '#f0f0f0',
                  stroke: '#ccc',
                  strokeWidth: 2,
                  strokeDashArray: [5, 5],
                  angle: element.rotation,
                });
                
                // Add text indicating failed load
                const errorText = new Text('Image\nFailed\nto Load', {
                  left: element.x + element.width / 2,
                  top: element.y + element.height / 2,
                  fontSize: 12,
                  fill: '#999',
                  textAlign: 'center',
                  originX: 'center',
                  originY: 'center',
                });
                
                (placeholder as any).elementId = element.id;
                fabricCanvas.add(placeholder);
                fabricCanvas.add(errorText);
                fabricCanvas.renderAll();
                
                toast.error(`Failed to load image: ${error.message || 'Unknown error'}`);
              });
            return;
          }
          break;

        case 'date':
          const dateText = element.properties.format 
            ? new Date().toLocaleDateString('en-US', {
                year: element.properties.format.includes('YYYY') ? 'numeric' : undefined,
                month: element.properties.format.includes('MM') ? '2-digit' : undefined,
                day: element.properties.format.includes('DD') ? '2-digit' : undefined,
              })
            : new Date().toLocaleDateString();

          fabricObject = new Text(dateText, {
            left: element.x,
            top: element.y,
            fontSize: element.properties.fontSize || 16,
            fontFamily: element.properties.fontFamily || 'Arial',
            fill: element.properties.color || '#000000',
            angle: element.rotation,
          });
          break;

        default:
          return;
      }

      if (fabricObject) {
        (fabricObject as any).elementId = element.id;
        fabricCanvas.add(fabricObject);
      }
    });

    fabricCanvas.renderAll();
  }, [fabricCanvas, design.elements]);

  // Handle zoom
  const handleZoom = useCallback((direction: 'in' | 'out') => {
    if (!fabricCanvas) return;

    const newZoom = direction === 'in' 
      ? Math.min(zoom * 1.1, 3)
      : Math.max(zoom / 1.1, 0.1);

    setZoom(newZoom);
    fabricCanvas.setZoom(newZoom);
    fabricCanvas.renderAll();
  }, [fabricCanvas, zoom]);

  // Handle panning
  useEffect(() => {
    if (!fabricCanvas) return;

    let isPanning = false;
    let lastPosX = 0;
    let lastPosY = 0;

    const handleMouseDown = (opt: any) => {
      const evt = opt.e;
      if (evt.altKey) {
        isPanning = true;
        fabricCanvas.selection = false;
        lastPosX = evt.clientX;
        lastPosY = evt.clientY;
      }
    };

    const handleMouseMove = (opt: any) => {
      if (isPanning) {
        const evt = opt.e;
        const vpt = fabricCanvas.viewportTransform;
        if (vpt) {
          vpt[4] += evt.clientX - lastPosX;
          vpt[5] += evt.clientY - lastPosY;
          fabricCanvas.requestRenderAll();
          lastPosX = evt.clientX;
          lastPosY = evt.clientY;
        }
      }
    };

    const handleMouseUp = () => {
      fabricCanvas.selection = true;
      isPanning = false;
    };

    fabricCanvas.on('mouse:down', handleMouseDown);
    fabricCanvas.on('mouse:move', handleMouseMove);
    fabricCanvas.on('mouse:up', handleMouseUp);

    return () => {
      fabricCanvas.off('mouse:down', handleMouseDown);
      fabricCanvas.off('mouse:move', handleMouseMove);
      fabricCanvas.off('mouse:up', handleMouseUp);
    };
  }, [fabricCanvas]);

  // Expose methods to parent via ref
  useImperativeHandle(ref, () => ({
    toDataURL: (opts?: { format?: string; multiplier?: number }) => {
      if (!fabricCanvas) return null;
      try {
        const options = { format: opts?.format || 'png', multiplier: opts?.multiplier || 1 } as any;
        return fabricCanvas.toDataURL(options);
      } catch (e) {
        return null;
      }
    },
    exportImage: async (filename = 'design.png') => {
      if (!fabricCanvas) {
        toast.error('Canvas is not ready');
        return;
      }
      try {
        const dataUrl = fabricCanvas.toDataURL({ format: 'png', multiplier: 2 } as any);
        const link = document.createElement('a');
        link.href = dataUrl;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        link.remove();
        toast.success('Export started');
      } catch (err) {
        toast.error('Failed to export image');
      }
    },

  exportPDF: async (filename = 'design.pdf') => {
      console.log('exportPDF called, fabricCanvas:', !!fabricCanvas);
      
      if (!fabricCanvas) {
        console.error('fabricCanvas is null');
        toast.error('Canvas is not ready - please wait a moment');
        return;
      }
      
      try {
        toast('Generating PDF...');
        console.log('Creating PDF with canvas dimensions:', fabricCanvas.getWidth(), 'x', fabricCanvas.getHeight());
        
        let dataUrl: string;
        
        try {
          // Try fabric canvas export first
          dataUrl = fabricCanvas.toDataURL({ format: 'png', multiplier: 2 } as any);
          console.log('Successfully exported using Fabric toDataURL');
        } catch (corsError) {
          console.log('Fabric export failed (likely CORS), trying html2canvas fallback:', corsError);
          
          // Fallback to html2canvas for CORS issues
          const canvasElement = fabricCanvas.getElement();
          const html2canvasResult = await html2canvas(canvasElement, {
            allowTaint: true,
            useCORS: true,
            scale: 2,
            backgroundColor: '#ffffff'
          });
          dataUrl = html2canvasResult.toDataURL('image/png');
          console.log('Successfully exported using html2canvas fallback');
        }
        
        if (!dataUrl) {
          throw new Error('Failed to generate canvas image');
        }
        
        const width = fabricCanvas.getWidth();
        const height = fabricCanvas.getHeight();

        const pdf = new jsPDF({ 
          orientation: width > height ? 'landscape' : 'portrait',
          unit: 'px', 
          format: [width, height] 
        });
        
        pdf.addImage(dataUrl, 'PNG', 0, 0, width, height);
        pdf.save(filename);
        toast.success('PDF downloaded successfully');
      } catch (err) {
        console.error('PDF export error:', err);
        toast.error('Failed to export PDF: ' + (err instanceof Error ? err.message : 'Unknown error'));
      }
    },

  print: async () => {
      console.log('print called, fabricCanvas:', !!fabricCanvas);
      
      if (!fabricCanvas) {
        console.error('fabricCanvas is null');
        toast.error('Canvas is not ready - please wait a moment');
        return;
      }
      
      try {
        toast('Preparing print...');
        console.log('Creating print PDF with canvas dimensions:', fabricCanvas.getWidth(), 'x', fabricCanvas.getHeight());
        
        let dataUrl: string;
        
        try {
          // Try fabric canvas export first
          dataUrl = fabricCanvas.toDataURL({ format: 'png', multiplier: 2 } as any);
          console.log('Successfully exported using Fabric toDataURL for print');
        } catch (corsError) {
          console.log('Fabric export failed for print (likely CORS), trying html2canvas fallback:', corsError);
          
          // Fallback to html2canvas for CORS issues
          const canvasElement = fabricCanvas.getElement();
          const html2canvasResult = await html2canvas(canvasElement, {
            allowTaint: true,
            useCORS: true,
            scale: 2,
            backgroundColor: '#ffffff'
          });
          dataUrl = html2canvasResult.toDataURL('image/png');
          console.log('Successfully exported using html2canvas fallback for print');
        }
        
        const width = fabricCanvas.getWidth();
        const height = fabricCanvas.getHeight();
        
        const pdf = new jsPDF({ 
          orientation: width > height ? 'landscape' : 'portrait',
          unit: 'px', 
          format: [width, height] 
        });
        
        pdf.addImage(dataUrl, 'PNG', 0, 0, width, height);

        // Create blob and open in new window for printing
        const blob = pdf.output('blob');
        const url = URL.createObjectURL(blob);
        const printWindow = window.open('', '_blank');
        
        if (!printWindow) {
          URL.revokeObjectURL(url);
          toast.error('Unable to open print window - please allow pop-ups');
          return;
        }

        printWindow.document.write(`
          <!DOCTYPE html>
          <html>
            <head>
              <title>Print Design</title>
              <style>
                body { margin: 0; padding: 0; }
                iframe { border: 0; width: 100vw; height: 100vh; }
              </style>
            </head>
            <body>
              <iframe src="${url}" onload="setTimeout(() => window.print(), 500)"></iframe>
            </body>
          </html>
        `);
        
        printWindow.document.close();
        printWindow.focus();

        // Clean up after a delay
        setTimeout(() => {
          URL.revokeObjectURL(url);
        }, 5000);
        
        toast.success('Print dialog opened');
      } catch (err) {
        console.error('Print error:', err);
        toast.error('Failed to open print dialog: ' + (err instanceof Error ? err.message : 'Unknown error'));
      }
    }
  }));

  // helper to wait until fabricCanvas is initialized
  const waitForCanvas = (timeout = 3000) => new Promise<FabricCanvas | null>((resolve) => {
    const start = Date.now();
    const check = () => {
      if (fabricCanvas) return resolve(fabricCanvas);
      if (Date.now() - start > timeout) return resolve(null);
      setTimeout(check, 50);
    };
    check();
  });

  return (
    <div className="flex flex-col items-center gap-4">
      {/* Canvas Controls */}
      <div className="flex items-center gap-2 bg-card border border-border rounded-md p-2">
        <button
          onClick={() => handleZoom('out')}
          className="px-2 py-1 text-sm hover:bg-accent rounded"
        >
          −
        </button>
        <span className="text-sm text-muted-foreground px-2">
          {Math.round(zoom * 100)}%
        </span>
        <button
          onClick={() => handleZoom('in')}
          className="px-2 py-1 text-sm hover:bg-accent rounded"
        >
          +
        </button>
        <div className="w-px h-4 bg-border mx-1" />
        <span className="text-xs text-muted-foreground">
          Alt + drag to pan
        </span>
      </div>

      {/* Canvas Container */}
      <div className="bg-card border border-border rounded-lg shadow-lg overflow-hidden">
        <canvas ref={canvasRef} />
      </div>
    </div>
  );
});