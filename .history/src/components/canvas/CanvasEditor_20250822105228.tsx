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
        imageSmoothingEnabled: false,
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
          onElementSelect((obj as any).elementId || null);
        } else {
          onElementSelect(null);
        }
      };

      const handleObjectMoving = (e: any) => {
        const obj = e.target;
        const elementId = (obj as any).elementId;
        if (elementId) {
          onElementUpdate(elementId, {
            x: obj.left,
            y: obj.top,
          });
        }
      };

      const handleObjectScaling = (e: any) => {
        const obj = e.target;
        const elementId = (obj as any).elementId;
        if (elementId) {
          onElementUpdate(elementId, {
            x: obj.left,
            y: obj.top,
            width: obj.width * obj.scaleX,
            height: obj.height * obj.scaleY,
          });
        }
      };

      const handleObjectRotating = (e: any) => {
        const obj = e.target;
        const elementId = (obj as any).elementId;
        if (elementId) {
          onElementUpdate(elementId, {
            rotation: obj.angle,
          });
        }
      };

      const handleObjectModified = (e: any) => {
        const obj = e.target;
        const elementId = (obj as any).elementId;
        if (elementId) {
          onElementUpdate(elementId, {
            x: obj.left,
            y: obj.top,
            width: obj.width * obj.scaleX,
            height: obj.height * obj.scaleY,
            rotation: obj.angle,
          });
        }
      };

      fabricCanvas.on('selection:created', handleSelection);
      fabricCanvas.on('selection:updated', handleSelection);
      fabricCanvas.on('selection:cleared', () => onElementSelect(null));
      fabricCanvas.on('object:moving', handleObjectMoving);
      fabricCanvas.on('object:scaling', handleObjectScaling);
      fabricCanvas.on('object:rotating', handleObjectRotating);
      fabricCanvas.on('object:modified', handleObjectModified);

      return () => {
        fabricCanvas.off('selection:created', handleSelection);
        fabricCanvas.off('selection:updated', handleSelection);
        fabricCanvas.off('selection:cleared');
        fabricCanvas.off('object:moving', handleObjectMoving);
        fabricCanvas.off('object:scaling', handleObjectScaling);
        fabricCanvas.off('object:rotating', handleObjectRotating);
        fabricCanvas.off('object:modified', handleObjectModified);
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
            
            // Helper function to create image with various fallback methods
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
                });
                (img as any).elementId = element.id;
                fabricCanvas.add(img);
                fabricCanvas.renderAll();
                toast.success('Image loaded successfully!');
              } catch (error) {
                console.error('All image loading attempts failed:', error);
                
                const placeholder = new Rect({
                  left: element.x,
                  top: element.y,
                  width: element.width,
                  height: element.height,
                  fill: '#f0f0f0',
                  stroke: '#ff6b6b',
                  strokeWidth: 2,
                  strokeDashArray: [5, 5],
                  angle: element.rotation,
                  selectable: true,
                  evented: true,
                  hasControls: true,
                  hasBorders: true,
                });
                
                const errorText = new Text('Image Failed\nto Load\n\nCheck URL or\ntry a different\nimage source', {
                  left: element.x + element.width / 2,
                  top: element.y + element.height / 2,
                  fontSize: 11,
                  fill: '#666',
                  textAlign: 'center',
                  originX: 'center',
                  originY: 'center',
                  selectable: false,
                  evented: false,
                });
                
                (placeholder as any).elementId = element.id;
                fabricCanvas.add(placeholder);
                fabricCanvas.add(errorText);
                fabricCanvas.renderAll();
                
                toast.error('Failed to load image. Try a direct image URL (ending in .jpg, .png, etc.) or check if the URL allows cross-origin access.');
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
          
          fabricCanvas.renderAll();
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

      // SIMPLE EXPORT METHODS - NO COMPLEX FALLBACKS
      exportPDF: async (filename = 'design.pdf') => {
        if (!fabricCanvas) {
          toast.error('Canvas is not ready');
          return;
        }
        
        try {
          toast('Exporting PDF...');
          
          // Direct export - no complex logic
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
          const dataUrl = fabricCanvas.toDataURL({
            format: 'png',
            quality: 1,
            multiplier: 1
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
          
          // Simple, direct export
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
