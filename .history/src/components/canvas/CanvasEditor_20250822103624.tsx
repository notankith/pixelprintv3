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
        let exportMethod = 'unknown';
        
        // Method 1: Try Fabric.js toDataURL first
        try {
          console.log('Attempting Fabric toDataURL for PDF export...');
          fabricCanvas.renderAll();
          
          // Get the exact viewport of the canvas
          const viewport = fabricCanvas.viewportTransform;
          console.log('Canvas viewport:', viewport);
          console.log('Canvas zoom:', fabricCanvas.getZoom());
          
          // Ensure we're capturing the exact visible area
          fabricCanvas.setViewportTransform([1, 0, 0, 1, 0, 0]); // Reset viewport
          fabricCanvas.setZoom(1); // Reset zoom
          fabricCanvas.renderAll();
          
          dataUrl = fabricCanvas.toDataURL({ 
            format: 'png',
            quality: 1,
            multiplier: 1,
            left: 0,
            top: 0,
            width: fabricCanvas.getWidth(),
            height: fabricCanvas.getHeight()
          } as any);
          
          // Restore original viewport
          fabricCanvas.setViewportTransform(viewport);
          fabricCanvas.renderAll();
          
          exportMethod = 'fabric-toDataURL';
          console.log('Successfully exported PDF using Fabric toDataURL');
        } catch (fabricError) {
          console.log('Fabric toDataURL failed:', fabricError);
          
          // Method 2: Try html2canvas on the canvas container
          try {
            const canvasContainer = fabricCanvas.getElement().parentElement;
            if (!canvasContainer) throw new Error('Canvas container not found');
            
            const html2canvasResult = await html2canvas(canvasContainer, {
              allowTaint: true,
              useCORS: false,
              scale: 2,
              backgroundColor: '#ffffff',
              logging: false,
              width: fabricCanvas.getWidth(),
              height: fabricCanvas.getHeight()
            });
            dataUrl = html2canvasResult.toDataURL('image/png', 0.9);
            exportMethod = 'html2canvas-container';
            console.log('Successfully exported using html2canvas on container');
          } catch (html2canvasError) {
            console.log('html2canvas on container failed:', html2canvasError);
            
            // Method 3: Try html2canvas directly on canvas element
            try {
              const canvasElement = fabricCanvas.getElement();
              const html2canvasResult = await html2canvas(canvasElement, {
                allowTaint: true,
                useCORS: false,
                scale: 2,
                backgroundColor: '#ffffff',
                logging: false
              });
              dataUrl = html2canvasResult.toDataURL('image/png', 0.9);
              exportMethod = 'html2canvas-direct';
              console.log('Successfully exported using html2canvas directly');
            } catch (directError) {
              console.log('html2canvas direct failed:', directError);
              
              // Method 4: Manual canvas rendering (last resort)
              try {
                // Create a new clean canvas
                const cleanCanvas = document.createElement('canvas');
                cleanCanvas.width = fabricCanvas.getWidth();
                cleanCanvas.height = fabricCanvas.getHeight();
                const ctx = cleanCanvas.getContext('2d');
                
                if (!ctx) throw new Error('Could not get canvas context');
                
                // Fill with white background
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, 0, cleanCanvas.width, cleanCanvas.height);
                
                // Try to draw each object manually
                const objects = fabricCanvas.getObjects();
                for (const obj of objects) {
                  if ((obj as any).type === 'text') {
                    const textObj = obj as any;
                    ctx.fillStyle = textObj.fill || '#000000';
                    ctx.font = `${textObj.fontSize || 16}px ${textObj.fontFamily || 'Arial'}`;
                    ctx.fillText(textObj.text || '', textObj.left || 0, (textObj.top || 0) + (textObj.fontSize || 16));
                  }
                  // Skip images to avoid CORS issues in this fallback
                }
                
                dataUrl = cleanCanvas.toDataURL('image/png', 0.9);
                exportMethod = 'manual-canvas';
                console.log('Successfully exported using manual canvas rendering');
              } catch (manualError) {
                console.error('All export methods failed:', manualError);
                throw new Error('Unable to export canvas - all methods failed');
              }
            }
          }
        }
        
        if (!dataUrl) {
          throw new Error('Failed to generate canvas image');
        }
        
        console.log(`Export successful using method: ${exportMethod}`);
        
        const width = fabricCanvas.getWidth();
        const height = fabricCanvas.getHeight();

        const pdf = new jsPDF({ 
          orientation: width > height ? 'landscape' : 'portrait',
          unit: 'px', 
          format: [width, height] 
        });
        
        pdf.addImage(dataUrl, 'PNG', 0, 0, width, height);
        pdf.save(filename);
        toast.success(`PDF downloaded successfully (${exportMethod})`);
      } catch (err) {
        console.error('PDF export error:', err);
        toast.error('Failed to export PDF: ' + (err instanceof Error ? err.message : 'Unknown error'));
      }
    },

  print: async () => {
      if (!fabricCanvas) {
        toast.error('Canvas is not ready');
        return;
      }
      
      try {
        toast('Exporting canvas...');
        
        // Simple, direct export - no complex fallbacks
        const dataUrl = fabricCanvas.toDataURL({
          format: 'png',
          quality: 1,
          multiplier: 1
        });
        
        if (!dataUrl || dataUrl.length < 100) {
          toast.error('Failed to export canvas');
          return;
        }
        
        // Create PDF with exact canvas size
        const width = fabricCanvas.getWidth();
        const height = fabricCanvas.getHeight();
        
        const pdf = new jsPDF({
          orientation: width > height ? 'landscape' : 'portrait',
          unit: 'px',
          format: [width, height]
        });
        
        pdf.addImage(dataUrl, 'PNG', 0, 0, width, height);
        
        // Open for printing
        const blob = pdf.output('blob');
        const url = URL.createObjectURL(blob);
        const printWindow = window.open(url, '_blank');
        
        if (printWindow) {
          printWindow.onload = () => {
            setTimeout(() => printWindow.print(), 500);
          };
          setTimeout(() => URL.revokeObjectURL(url), 5000);
          toast.success('Print dialog opened');
        } else {
          // Download if popup blocked
          const a = document.createElement('a');
          a.href = url;
          a.download = 'design.pdf';
          a.click();
          URL.revokeObjectURL(url);
          toast.success('PDF downloaded');
        }
        
      } catch (error) {
        console.error('Print failed:', error);
        toast.error('Print failed');
      }
    },

        // Method 1: Try Fabric.js toDataURL (should work for text elements)
        try {
          console.log('Attempting Fabric toDataURL...');
          fabricCanvas.renderAll();
          
          // Get the exact viewport of the canvas
          const viewport = fabricCanvas.viewportTransform;
          console.log('Canvas viewport:', viewport);
          console.log('Canvas zoom:', fabricCanvas.getZoom());
          
          // Ensure we're capturing the exact visible area
          fabricCanvas.setViewportTransform([1, 0, 0, 1, 0, 0]); // Reset viewport
          fabricCanvas.setZoom(1); // Reset zoom
          fabricCanvas.renderAll();
          
          dataUrl = fabricCanvas.toDataURL({ 
            format: 'png',
            quality: 1,
            multiplier: 1,
            left: 0,
            top: 0,
            width: fabricCanvas.getWidth(),
            height: fabricCanvas.getHeight()
          } as any);
          
          // Restore original viewport
          fabricCanvas.setViewportTransform(viewport);
          fabricCanvas.renderAll();
          
          if (dataUrl && dataUrl !== 'data:,' && dataUrl.length > 100) {
            exportMethod = 'fabric-toDataURL';
            console.log('✅ Fabric toDataURL succeeded, dataUrl length:', dataUrl.length);
          } else {
            throw new Error('Fabric toDataURL returned invalid data');
          }
        } catch (fabricError) {
          console.log('❌ Fabric toDataURL failed:', fabricError);
          lastError = fabricError;
          dataUrl = ''; // Reset dataUrl on failure          // Method 2: Try html2canvas on canvas element with exact settings
          try {
            console.log('Attempting html2canvas direct...');
            const canvasElement = fabricCanvas.getElement();
            
            // Get exact canvas dimensions
            const canvasWidth = fabricCanvas.getWidth();
            const canvasHeight = fabricCanvas.getHeight();
            
            console.log('Canvas element dimensions:', canvasWidth, 'x', canvasHeight);
            
            const html2canvasResult = await html2canvas(canvasElement, {
              allowTaint: true,
              useCORS: true,
              scale: 1,
              width: canvasWidth,
              height: canvasHeight,
              backgroundColor: '#ffffff',
              logging: false,
              ignoreElements: (element) => {
                // Only capture the canvas element itself
                return element !== canvasElement;
              }
            });
            
            dataUrl = html2canvasResult.toDataURL('image/png', 1.0);
            exportMethod = 'html2canvas-direct';
            console.log('✅ html2canvas direct succeeded');
          } catch (directError) {
            console.log('❌ html2canvas direct failed:', directError);
            lastError = directError;
            
            // Method 3: Try direct canvas copy with exact dimensions
            try {
              console.log('Attempting exact canvas copy...');
              const originalCanvas = fabricCanvas.getElement();
              const newCanvas = document.createElement('canvas');
              
              // Use the exact Fabric canvas dimensions
              const canvasWidth = fabricCanvas.getWidth();
              const canvasHeight = fabricCanvas.getHeight();
              
              newCanvas.width = canvasWidth;
              newCanvas.height = canvasHeight;
              const ctx = newCanvas.getContext('2d');
              
              if (!ctx) throw new Error('Could not get 2D context');
              
              console.log('Copying canvas with exact dimensions:', canvasWidth, 'x', canvasHeight);
              
              // Fill with white background
              ctx.fillStyle = '#ffffff';
              ctx.fillRect(0, 0, canvasWidth, canvasHeight);
              
              // Copy the original canvas exactly
              try {
                ctx.drawImage(originalCanvas, 0, 0, canvasWidth, canvasHeight, 0, 0, canvasWidth, canvasHeight);
                dataUrl = newCanvas.toDataURL('image/png', 1.0);
                exportMethod = 'canvas-copy-exact';
                console.log('✅ Exact canvas copy succeeded');
              } catch (copyError) {
                console.log('❌ Canvas copy failed, trying text-only render:', copyError);
                
                // Method 4: Manual exact rendering with all elements
                console.log('Attempting manual exact rendering...');
                const objects = fabricCanvas.getObjects();
                
                // Use exact Fabric canvas dimensions
                const canvasWidth = fabricCanvas.getWidth();
                const canvasHeight = fabricCanvas.getHeight();
                
                newCanvas.width = canvasWidth;
                newCanvas.height = canvasHeight;
                
                console.log('Manual rendering with exact dimensions:', canvasWidth, 'x', canvasHeight);
                
                // Clear and fill background
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, 0, canvasWidth, canvasHeight);
                
                // Render ALL elements with their exact Fabric.js transformations
                for (const obj of objects) {
                  try {
                    ctx.save();
                    
                    // Get the exact transformation matrix from Fabric.js
                    const matrix = obj.calcTransformMatrix();
                    ctx.setTransform(matrix[0], matrix[1], matrix[2], matrix[3], matrix[4], matrix[5]);
                    
                    if ((obj as any).type === 'image') {
                      const imgObj = obj as any;
                      console.log('Rendering image with exact transforms:', imgObj);
                      
                      // Check if image is ready and valid
                      if (imgObj._element && 
                          imgObj._element.complete && 
                          imgObj._element.naturalWidth > 0 && 
                          !imgObj._element.error) {
                        
                        try {
                          // Use the exact dimensions and positioning from Fabric.js
                          const imgWidth = imgObj.width * imgObj.scaleX;
                          const imgHeight = imgObj.height * imgObj.scaleY;
                          
                          ctx.drawImage(
                            imgObj._element,
                            -imgWidth / 2,
                            -imgHeight / 2,
                            imgWidth,
                            imgHeight
                          );
                          console.log('✅ Image rendered with exact positioning');
                        } catch (imgDrawError) {
                          console.log('❌ Failed to draw image:', imgDrawError);
                          // Draw placeholder with exact dimensions
                          const imgWidth = imgObj.width * imgObj.scaleX;
                          const imgHeight = imgObj.height * imgObj.scaleY;
                          
                          ctx.fillStyle = '#f0f0f0';
                          ctx.fillRect(-imgWidth / 2, -imgHeight / 2, imgWidth, imgHeight);
                          ctx.strokeStyle = '#ccc';
                          ctx.lineWidth = 2;
                          ctx.strokeRect(-imgWidth / 2, -imgHeight / 2, imgWidth, imgHeight);
                          
                          ctx.fillStyle = '#666';
                          ctx.font = '16px Arial';
                          ctx.textAlign = 'center';
                          ctx.textBaseline = 'middle';
                          ctx.fillText('📷', 0, 0);
                        }
                      } else {
                        console.log('❌ Image not ready, drawing placeholder');
                        // Draw placeholder with exact dimensions
                        const imgWidth = imgObj.width * imgObj.scaleX;
                        const imgHeight = imgObj.height * imgObj.scaleY;
                        
                        ctx.fillStyle = '#f8f8f8';
                        ctx.fillRect(-imgWidth / 2, -imgHeight / 2, imgWidth, imgHeight);
                        ctx.strokeStyle = '#ddd';
                        ctx.lineWidth = 2;
                        ctx.strokeRect(-imgWidth / 2, -imgHeight / 2, imgWidth, imgHeight);
                        
                        ctx.fillStyle = '#999';
                        ctx.font = '20px Arial';
                        ctx.textAlign = 'center';
                        ctx.textBaseline = 'middle';
                        ctx.fillText('🖼️', 0, 0);
                      }
                    } else if ((obj as any).type === 'text') {
                      const textObj = obj as any;
                      
                      // Use exact Fabric.js text properties
                      ctx.fillStyle = textObj.fill || '#000000';
                      ctx.font = `${textObj.fontSize || 16}px ${textObj.fontFamily || 'Arial'}`;
                      ctx.textAlign = textObj.textAlign || 'left';
                      ctx.textBaseline = 'alphabetic';
                      
                      // Render text at exact position (Fabric.js handles transforms via matrix)
                      ctx.fillText(textObj.text || '', 0, 0);
                    } else if ((obj as any).type === 'rect') {
                      const rectObj = obj as any;
                      
                      // Use exact dimensions
                      const rectWidth = rectObj.width * rectObj.scaleX;
                      const rectHeight = rectObj.height * rectObj.scaleY;
                      
                      ctx.fillStyle = rectObj.fill || '#cccccc';
                      ctx.fillRect(-rectWidth / 2, -rectHeight / 2, rectWidth, rectHeight);
                    }
                    
                    ctx.restore();
                  } catch (objError) {
                    console.log('❌ Failed to render object:', objError);
                    // Continue with next object
                  }
                }
                
                dataUrl = newCanvas.toDataURL('image/png', 1.0);
                exportMethod = 'manual-exact-render';
                console.log('✅ Manual exact rendering succeeded');
              }
            } catch (manualError) {
              console.log('❌ Manual rendering failed:', manualError);
              lastError = manualError;
            }
          }
        }
        
        // Check if we have valid data before proceeding
        if (!dataUrl || dataUrl === 'data:,' || dataUrl.length < 100) {
          console.log('❌ All canvas export methods failed, using emergency text-only fallback');
          
          // Method 5: Emergency fallback - create a simple PDF with text
          const pdf = new jsPDF({ 
            orientation: 'portrait',
            unit: 'mm', 
            format: 'a4' 
          });
          
          pdf.setFontSize(16);
          pdf.text('Design Export', 20, 30);
          pdf.setFontSize(12);
          pdf.text('Unable to render canvas - text elements only:', 20, 50);
          
          let yPos = 70;
          const objects = fabricCanvas.getObjects();
          for (const obj of objects) {
            if ((obj as any).type === 'text') {
              const textObj = obj as any;
              pdf.text(`• ${textObj.text || 'Text element'}`, 30, yPos);
              yPos += 10;
            }
          }
          
          // Open PDF directly for printing
          const blob = pdf.output('blob');
          const url = URL.createObjectURL(blob);
          
          const printWindow = window.open(url, '_blank');
          
          if (!printWindow) {
            // Fallback: Download the PDF if popup is blocked
            const link = document.createElement('a');
            link.href = url;
            link.download = 'design-print-text-only.pdf';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
            toast.error('Pop-ups blocked - PDF downloaded instead. Please open and print manually.');
            return;
          }

          // Wait for PDF to load, then trigger print
          printWindow.onload = () => {
            setTimeout(() => {
              try {
                printWindow.print();
              } catch (e) {
                console.log('Direct print failed, user can print manually');
              }
            }, 1000);
          };

          setTimeout(() => {
            URL.revokeObjectURL(url);
          }, 10000);
          
          toast.success('Print dialog opened (text-only mode)');
          return;
        }
        
        console.log(`Print export successful using method: ${exportMethod}`);
        
        const width = fabricCanvas.getWidth();
        const height = fabricCanvas.getHeight();
        
        // Create PDF with exact canvas dimensions
        const pdf = new jsPDF({ 
          orientation: width > height ? 'landscape' : 'portrait',
          unit: 'px', 
          format: [width, height],
          compress: true
        });
        
        // Add image to fill the entire PDF page
        pdf.addImage(dataUrl, 'PNG', 0, 0, width, height, '', 'FAST');

        // Create blob and open PDF directly for printing
        const blob = pdf.output('blob');
        const url = URL.createObjectURL(blob);
        
        // Create a temporary link to download/print the PDF
        const link = document.createElement('a');
        link.href = url;
        link.target = '_blank';
        
        // Try to open PDF in new window with direct print
        const printWindow = window.open(url, '_blank');
        
        if (!printWindow) {
          // Fallback: Download the PDF if popup is blocked
          link.download = 'design-print.pdf';
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(url);
          toast.error('Pop-ups blocked - PDF downloaded instead. Please open and print manually.');
          return;
        }

        // Wait for PDF to load, then trigger print
        printWindow.onload = () => {
          setTimeout(() => {
            try {
              printWindow.print();
            } catch (e) {
              console.log('Direct print failed, user can print manually');
            }
          }, 1000);
        };

        // Clean up after a delay
        setTimeout(() => {
          URL.revokeObjectURL(url);
        }, 10000);
        
        toast.success(`Print dialog opened (${exportMethod})`);
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