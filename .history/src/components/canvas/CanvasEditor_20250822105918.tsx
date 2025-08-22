import React, { useRef, useEffect, useState, useImperativeHandle, forwardRef } from 'react';
import { Canvas as FabricCanvas, Text, Image, Rect } from 'fabric';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { toast } from 'sonner';
import type { Design, DesignElement } from '../StickerDesigner';

export interface CanvasEditorHandle {
  addElement: (element: DesignElement) => void;
  updateElement: (id: string, updates: Partial<DesignElement>) => void;
  deleteElement: (id: string) => void;
  selectElement: (id: string | null) => void;
  clearCanvas: () => void;
  exportPDF: (filename?: string) => Promise<void>;
  exportImage: (filename?: string) => Promise<void>;
  print: () => Promise<void>;
}

interface CanvasEditorProps {
  design: Design;
  selectedElementId: string | null;
  onElementSelect: (id: string | null) => void;
  onElementUpdate: (id: string, updates: Partial<DesignElement>) => void;
}

const CanvasEditor = forwardRef<CanvasEditorHandle, CanvasEditorProps>(
  ({ design, selectedElementId, onElementSelect, onElementUpdate }, ref) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [fabricCanvas, setFabricCanvas] = useState<FabricCanvas | null>(null);

    // Initialize Fabric Canvas
    useEffect(() => {
      if (!canvasRef.current) return;

      console.log('Initializing Fabric canvas...');
      const canvas = new FabricCanvas(canvasRef.current, {
        width: design.canvasWidth,
        height: design.canvasHeight,
        backgroundColor: '#ffffff',
        selection: true,
        preserveObjectStacking: true,
        allowTouchScrolling: false,
        imageSmoothingEnabled: true,
        interactive: true,
        moveCursor: 'move',
        hoverCursor: 'move',
        defaultCursor: 'default',
        freeDrawingCursor: 'crosshair',
        rotationCursor: 'crosshair',
        // Ensure proper rendering for export
        renderOnAddRemove: true,
        skipTargetFind: false,
        perPixelTargetFind: true,
        targetFindTolerance: 4,
      });

      console.log('Fabric canvas created, setting state...');
      setFabricCanvas(canvas);

      return () => {
        console.log('Disposing Fabric canvas...');
        canvas.dispose();
      };
    }, [design.canvasWidth, design.canvasHeight]);

    // Handle canvas events
    useEffect(() => {
      if (!fabricCanvas) return;

      const handleSelection = (e: any) => {
        if (e.selected && e.selected.length > 0) {
          const obj = e.selected[0];
          const elementId = (obj as any).elementId;
          console.log('Element selected:', elementId);
          onElementSelect(elementId || null);
        } else {
          console.log('Selection cleared');
          onElementSelect(null);
        }
      };

      const handleObjectMoving = (e: any) => {
        const obj = e.target;
        const elementId = (obj as any).elementId;
        if (elementId) {
          onElementUpdate(elementId, {
            x: Math.round(obj.left),
            y: Math.round(obj.top),
          });
        }
      };

      const handleObjectScaling = (e: any) => {
        const obj = e.target;
        const elementId = (obj as any).elementId;
        if (elementId) {
          onElementUpdate(elementId, {
            x: Math.round(obj.left),
            y: Math.round(obj.top),
            width: Math.round(obj.width * obj.scaleX),
            height: Math.round(obj.height * obj.scaleY),
          });
        }
      };

      const handleObjectRotating = (e: any) => {
        const obj = e.target;
        const elementId = (obj as any).elementId;
        if (elementId) {
          onElementUpdate(elementId, {
            rotation: Math.round(obj.angle),
          });
        }
      };

      const handleObjectModified = (e: any) => {
        const obj = e.target;
        const elementId = (obj as any).elementId;
        if (elementId) {
          console.log('Object modified:', elementId);
          onElementUpdate(elementId, {
            x: Math.round(obj.left),
            y: Math.round(obj.top),
            width: Math.round(obj.width * obj.scaleX),
            height: Math.round(obj.height * obj.scaleY),
            rotation: Math.round(obj.angle),
          });
          
          // Keep the object selected after modification
          fabricCanvas.setActiveObject(obj);
          fabricCanvas.renderAll();
        }
      };

      // Mouse events to prevent deselection during interactions
      const handleMouseDown = (e: any) => {
        if (e.target) {
          // Clicking on an object - keep it selected
          const elementId = (e.target as any).elementId;
          if (elementId) {
            fabricCanvas.setActiveObject(e.target);
          }
        }
      };

      fabricCanvas.on('selection:created', handleSelection);
      fabricCanvas.on('selection:updated', handleSelection);
      fabricCanvas.on('selection:cleared', () => onElementSelect(null));
      fabricCanvas.on('object:moving', handleObjectMoving);
      fabricCanvas.on('object:scaling', handleObjectScaling);
      fabricCanvas.on('object:rotating', handleObjectRotating);
      fabricCanvas.on('object:modified', handleObjectModified);
      fabricCanvas.on('mouse:down', handleMouseDown);

      return () => {
        fabricCanvas.off('selection:created', handleSelection);
        fabricCanvas.off('selection:updated', handleSelection);
        fabricCanvas.off('selection:cleared');
        fabricCanvas.off('object:moving', handleObjectMoving);
        fabricCanvas.off('object:scaling', handleObjectScaling);
        fabricCanvas.off('object:rotating', handleObjectRotating);
        fabricCanvas.off('object:modified', handleObjectModified);
        fabricCanvas.off('mouse:down', handleMouseDown);
      };
    }, [fabricCanvas, onElementSelect, onElementUpdate]);

    // Add elements to canvas
    const addElementToCanvas = (element: DesignElement) => {
      if (!fabricCanvas) return;

      switch (element.type) {
        case 'text':
          const text = new Text(element.properties.text || 'Sample Text', {
            left: element.x,
            top: element.y,
            fontSize: element.properties.fontSize || 16,
            fontFamily: element.properties.fontFamily || 'Arial',
            fill: element.properties.color || '#000000',
            angle: element.rotation,
            selectable: true,
            evented: true,
            hasControls: true,
            hasBorders: true,
            hasRotatingPoint: true,
          });
          (text as any).elementId = element.id;
          fabricCanvas.add(text);
          break;

        case 'image':
          if (element.properties.url) {
            console.log('Loading image:', element.properties.url);
            
            // Enhanced image loading with better canvas integration
            const loadImageWithFallbacks = async (url: string) => {
              const attempts = [
                // Method 1: Direct load
                () => Image.fromURL(url),
                // Method 2: With anonymous crossOrigin
                () => Image.fromURL(url, { crossOrigin: 'anonymous' }),
                // Method 3: With use-credentials crossOrigin
                () => Image.fromURL(url, { crossOrigin: 'use-credentials' }),
                // Method 4: Using a proxy service for CORS issues
                () => Image.fromURL(`https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`),
              ];

              for (let i = 0; i < attempts.length; i++) {
                try {
                  console.log(`Image load attempt ${i + 1} for:`, url);
                  const img = await attempts[i]();
                  console.log('Image loaded successfully on attempt', i + 1);
                  
                  // Ensure the image is properly embedded
                  img.set({
                    crossOrigin: 'anonymous',
                    evented: true,
                    selectable: true,
                  });
                  
                  return img;
                } catch (error) {
                  console.log(`Attempt ${i + 1} failed:`, error);
                  if (i === attempts.length - 1) {
                    throw error; // Last attempt failed
                  }
                }
              }
            };
            
            const loadImage = async () => {
              try {
                const img = await loadImageWithFallbacks(element.properties.url);
                
                // Configure image for proper canvas integration
                img.set({
                  left: element.x,
                  top: element.y,
                  scaleX: element.width / (img.width || 1),
                  scaleY: element.height / (img.height || 1),
                  angle: element.rotation,
                  selectable: true,
                  evented: true,
                  hasControls: true,
                  hasBorders: true,
                  hasRotatingPoint: true,
                  lockUniScaling: false,
                  transparentCorners: false,
                  cornerStyle: 'rect',
                  cornerStrokeColor: '#2196F3',
                  cornerColor: '#2196F3',
                  borderColor: '#2196F3',
                  // Ensure image is embedded in canvas for export
                  crossOrigin: 'anonymous',
                });
                
                (img as any).elementId = element.id;
                
                // Add to canvas and ensure proper rendering
                fabricCanvas.add(img);
                fabricCanvas.renderAll();
                
                // Force a canvas refresh to ensure image is properly embedded
                setTimeout(() => {
                  fabricCanvas.renderAll();
                }, 100);
                
                toast.success('Image loaded and ready for export!');
                
              } catch (error) {
                console.error('All image loading attempts failed:', error);
                
                // Create a more visible error placeholder
                const placeholder = new Rect({
                  left: element.x,
                  top: element.y,
                  width: element.width,
                  height: element.height,
                  fill: '#ffebee',
                  stroke: '#f44336',
                  strokeWidth: 2,
                  strokeDashArray: [10, 5],
                  angle: element.rotation,
                  selectable: true,
                  evented: true,
                  hasControls: true,
                  hasBorders: true,
                  opacity: 0.8,
                });
                
                const errorText = new Text('⚠️ Image Failed to Load\n\nTry:\n• Direct image URL\n• Different image source\n• Check image permissions', {
                  left: element.x + element.width / 2,
                  top: element.y + element.height / 2,
                  fontSize: 10,
                  fill: '#d32f2f',
                  textAlign: 'center',
                  originX: 'center',
                  originY: 'center',
                  selectable: false,
                  evented: false,
                  fontFamily: 'Arial',
                });
                
                (placeholder as any).elementId = element.id;
                fabricCanvas.add(placeholder);
                fabricCanvas.add(errorText);
                fabricCanvas.renderAll();
                
                toast.error('Failed to load image. Try a direct image URL (ending in .jpg, .png, etc.)');
              }
            };

            loadImage();
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

          const dateElement = new Text(dateText, {
            left: element.x,
            top: element.y,
            fontSize: element.properties.fontSize || 16,
            fontFamily: element.properties.fontFamily || 'Arial',
            fill: element.properties.color || '#000000',
            angle: element.rotation,
            selectable: true,
            evented: true,
            hasControls: true,
            hasBorders: true,
            hasRotatingPoint: true,
          });
          (dateElement as any).elementId = element.id;
          fabricCanvas.add(dateElement);
          break;
      }

      fabricCanvas.renderAll();
    };

    // Load elements when design changes
    useEffect(() => {
      if (!fabricCanvas) return;

      fabricCanvas.clear();
      design.elements.forEach(addElementToCanvas);
    }, [fabricCanvas, design.elements]);

    // Expose canvas methods
    useImperativeHandle(ref, () => ({
      addElement: addElementToCanvas,
      
      updateElement: (id: string, updates: Partial<DesignElement>) => {
        if (!fabricCanvas) return;
        
        const objects = fabricCanvas.getObjects();
        const obj = objects.find((o) => (o as any).elementId === id);
        
        if (obj) {
          const wasSelected = fabricCanvas.getActiveObject() === obj;
          
          if (updates.x !== undefined) obj.set('left', updates.x);
          if (updates.y !== undefined) obj.set('top', updates.y);
          if (updates.rotation !== undefined) obj.set('angle', updates.rotation);
          
          if (updates.width !== undefined || updates.height !== undefined) {
            const currentWidth = obj.width || 1;
            const currentHeight = obj.height || 1;
            
            if (updates.width !== undefined) {
              obj.set('scaleX', updates.width / currentWidth);
            }
            if (updates.height !== undefined) {
              obj.set('scaleY', updates.height / currentHeight);
            }
          }
          
          // Update text content if it's a text element
          if (obj.type === 'text' && updates.properties?.text !== undefined) {
            (obj as any).set('text', updates.properties.text);
          }
          
          // Update other text properties
          if (obj.type === 'text' && updates.properties) {
            if (updates.properties.fontSize !== undefined) {
              obj.set('fontSize', updates.properties.fontSize);
            }
            if (updates.properties.fontFamily !== undefined) {
              obj.set('fontFamily', updates.properties.fontFamily);
            }
            if (updates.properties.color !== undefined) {
              obj.set('fill', updates.properties.color);
            }
          }
          
          fabricCanvas.renderAll();
          
          // Maintain selection if the object was previously selected
          if (wasSelected) {
            fabricCanvas.setActiveObject(obj);
            fabricCanvas.renderAll();
          }
        }
      },
      
      deleteElement: (id: string) => {
        if (!fabricCanvas) return;
        
        const objects = fabricCanvas.getObjects();
        const obj = objects.find((o) => (o as any).elementId === id);
        
        if (obj) {
          fabricCanvas.remove(obj);
          fabricCanvas.renderAll();
        }
      },
      
      selectElement: (id: string | null) => {
        if (!fabricCanvas) return;
        
        if (!id) {
          fabricCanvas.discardActiveObject();
          fabricCanvas.renderAll();
          return;
        }
        
        const objects = fabricCanvas.getObjects();
        const obj = objects.find((o) => (o as any).elementId === id);
        
        if (obj) {
          fabricCanvas.setActiveObject(obj);
          fabricCanvas.renderAll();
        }
      },
      
      clearCanvas: () => {
        if (!fabricCanvas) return;
        fabricCanvas.clear();
      },

      // ENHANCED EXPORT METHODS WITH PROPER IMAGE HANDLING
      exportPDF: async (filename = 'design.pdf') => {
        if (!fabricCanvas) {
          toast.error('Canvas is not ready');
          return;
        }
        
        try {
          toast('Exporting PDF...');
          
          // Deselect all objects to avoid selection borders in export
          fabricCanvas.discardActiveObject();
          fabricCanvas.renderAll();
          
          // Wait a moment for render to complete
          await new Promise(resolve => setTimeout(resolve, 100));
          
          // Export with high quality and multiplier for crisp images
          const dataUrl = fabricCanvas.toDataURL({
            format: 'png',
            quality: 1,
            multiplier: 2, // Higher resolution for better quality
            enableRetinaScaling: false
          });
          
          if (!dataUrl || dataUrl.length < 100) {
            toast.error('Failed to export canvas');
            return;
          }
          
          // Create PDF with exact canvas size
          const width = fabricCanvas.getWidth();
          const height = fabricCanvas.getHeight();
          
          // Use points (72 DPI) for PDF for proper sizing
          const pdfWidth = width * 0.75; // Convert px to pt (1px = 0.75pt)
          const pdfHeight = height * 0.75;
          
          const pdf = new jsPDF({
            orientation: width > height ? 'landscape' : 'portrait',
            unit: 'pt',
            format: [pdfWidth, pdfHeight]
          });
          
          pdf.addImage(dataUrl, 'PNG', 0, 0, pdfWidth, pdfHeight, undefined, 'FAST');
          pdf.save(filename);
          
          toast.success('PDF exported successfully');
          
        } catch (error) {
          console.error('Export failed:', error);
          toast.error('Failed to export PDF');
        }
      },

      exportImage: async (filename = 'design.png') => {
        if (!fabricCanvas) {
          toast.error('Canvas is not ready');
          return;
        }
        
        try {
          // Deselect all objects to avoid selection borders in export
          fabricCanvas.discardActiveObject();
          fabricCanvas.renderAll();
          
          // Wait a moment for render to complete
          await new Promise(resolve => setTimeout(resolve, 100));
          
          const dataUrl = fabricCanvas.toDataURL({
            format: 'png',
            quality: 1,
            multiplier: 2, // Higher resolution
            enableRetinaScaling: false
          });
          
          const link = document.createElement('a');
          link.download = filename;
          link.href = dataUrl;
          link.click();
          
          toast.success('Image exported successfully');
        } catch (error) {
          console.error('Export failed:', error);
          toast.error('Failed to export image');
        }
      },

      print: async () => {
        if (!fabricCanvas) {
          toast.error('Canvas is not ready');
          return;
        }
        
        try {
          toast('Preparing print...');
          
          // Deselect all objects to avoid selection borders in print
          fabricCanvas.discardActiveObject();
          fabricCanvas.renderAll();
          
          // Wait a moment for render to complete
          await new Promise(resolve => setTimeout(resolve, 100));
          
          // Export with high quality for print
          const dataUrl = fabricCanvas.toDataURL({
            format: 'png',
            quality: 1,
            multiplier: 2, // Higher resolution for print
            enableRetinaScaling: false
          });
          
          if (!dataUrl || dataUrl.length < 100) {
            toast.error('Failed to export canvas for printing');
            return;
          }
          
          // Create PDF with exact canvas size for printing
          const width = fabricCanvas.getWidth();
          const height = fabricCanvas.getHeight();
          
          // Use points for PDF
          const pdfWidth = width * 0.75;
          const pdfHeight = height * 0.75;
          
          const pdf = new jsPDF({
            orientation: width > height ? 'landscape' : 'portrait',
            unit: 'pt',
            format: [pdfWidth, pdfHeight]
          });
          
          pdf.addImage(dataUrl, 'PNG', 0, 0, pdfWidth, pdfHeight, undefined, 'FAST');
          
          // Open for printing with better error handling
          const blob = pdf.output('blob');
          const url = URL.createObjectURL(blob);
          
          try {
            const printWindow = window.open(url, '_blank', 'width=800,height=600');
            
            if (printWindow) {
              printWindow.onload = () => {
                setTimeout(() => {
                  printWindow.print();
                  printWindow.focus();
                }, 1000); // Longer delay for images to load
              };
              
              // Clean up URL after some time
              setTimeout(() => {
                URL.revokeObjectURL(url);
                try {
                  if (!printWindow.closed) {
                    printWindow.close();
                  }
                } catch (e) {
                  // Ignore close errors
                }
              }, 10000);
              
              toast.success('Print dialog opened');
            } else {
              throw new Error('Popup blocked');
            }
          } catch (popupError) {
            // Fallback: download PDF if popup is blocked
            const a = document.createElement('a');
            a.href = url;
            a.download = 'design-print.pdf';
            a.click();
            URL.revokeObjectURL(url);
            toast.success('PDF downloaded (popup was blocked)');
          }
          
        } catch (error) {
          console.error('Print failed:', error);
          toast.error('Print failed');
        }
      }
    }), [fabricCanvas, design.elements]);

    return (
      <div className="flex-1 flex items-center justify-center bg-gray-100 p-4">
        <div className="border border-gray-300 shadow-lg">
          <canvas ref={canvasRef} />
        </div>
      </div>
    );
  }
);

CanvasEditor.displayName = 'CanvasEditor';

export default CanvasEditor;
