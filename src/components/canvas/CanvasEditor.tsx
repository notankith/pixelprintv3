import React, { useRef, useEffect, useState, useImperativeHandle, forwardRef } from 'react';
import { Canvas as FabricCanvas, Text, Image, Rect } from 'fabric';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { toast } from 'sonner';
import type { Design, DesignElement } from '../StickerDesigner';
import { registerCanvas, unregisterCanvas, clearCanvas } from '@/utils/canvasManager';

export interface CanvasEditorHandle {
  addElement: (element: DesignElement) => void;
  updateElement: (id: string, updates: Partial<DesignElement>) => void;
  deleteElement: (id: string) => void;
  selectElement: (id: string | null) => void;
  clearCanvas: () => void;
  exportPDF: (filename?: string) => Promise<void>;
  exportImage: (filename?: string) => Promise<void>;
  print: () => Promise<void>;
  generateLiveThumbnail: () => Promise<string>;
  getCanvasDataURL: () => Promise<string>;
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

    // Initialize Fabric Canvas (only once)
    useEffect(() => {
      if (!canvasRef.current || fabricCanvas) return;

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
    }, []); // Only run once, don't depend on design dimensions

    // Handle canvas size changes separately
    useEffect(() => {
      if (!fabricCanvas) return;

      console.log('Updating canvas size to:', design.canvasWidth, 'x', design.canvasHeight);
      
      // Update canvas dimensions without recreating
      fabricCanvas.setWidth(design.canvasWidth);
      fabricCanvas.setHeight(design.canvasHeight);
      
      // Update the underlying canvas element size
      const canvasElement = fabricCanvas.getElement();
      if (canvasElement) {
        canvasElement.width = design.canvasWidth;
        canvasElement.height = design.canvasHeight;
      }
      
      // Re-render the canvas
      fabricCanvas.renderAll();
      
      console.log('Canvas size updated successfully');
    }, [fabricCanvas, design.canvasWidth, design.canvasHeight]);

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
          // Update position but don't trigger full reload
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
          // Update size but don't trigger full reload
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
          // Update rotation but don't trigger full reload
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
          
          // Ensure coordinates are updated after modification
          obj.setCoords();
          
          // Final update after modification is complete
          onElementUpdate(elementId, {
            x: Math.round(obj.left),
            y: Math.round(obj.top),
            width: Math.round(obj.width * obj.scaleX),
            height: Math.round(obj.height * obj.scaleY),
            rotation: Math.round(obj.angle),
          });
          
          // Ensure object stays selected after modification with proper coordinates
          setTimeout(() => {
            if (fabricCanvas.getActiveObject() !== obj) {
              fabricCanvas.setActiveObject(obj);
            }
            obj.setCoords();
            fabricCanvas.renderAll();
            
            // Extra step to ensure transform controls are perfectly aligned
            fabricCanvas.requestRenderAll();
          }, 10);
        }
      };

      // Handle coordinate updates during transforms - ensures transform controls stay aligned
      const handleAfterTransform = (e: any) => {
        const obj = e.target;
        if (obj) {
          obj.setCoords();
          fabricCanvas.renderAll();
          
          // Additional render pass to ensure perfect alignment
          setTimeout(() => {
            obj.setCoords();
            fabricCanvas.requestRenderAll();
          }, 0);
        }
      };

      // Enhanced mouse down handler to maintain selection
      const handleMouseDown = (e: any) => {
        const target = e.target;
        if (target && (target as any).elementId) {
          // Clicking on an object - ensure it becomes/stays selected
          fabricCanvas.setActiveObject(target);
          fabricCanvas.renderAll();
        }
        // If clicking on canvas background, selection will naturally clear
      };

      // Prevent accidental deselection during interactions
      const handleBeforeSelectionCleared = (e: any) => {
        // Only allow deselection if clicking on canvas background
        if (e.e && e.e.target && e.e.target.tagName === 'CANVAS') {
          const pointer = fabricCanvas.getPointer(e.e);
          const objectsAtPoint = fabricCanvas.getObjects().filter(obj => 
            obj.containsPoint(pointer)
          );
          
          // If there are objects at this point, don't clear selection
          if (objectsAtPoint.length > 0) {
            e.preventDefault?.();
            return false;
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
            fontWeight: element.properties.bold ? 'bold' : 'normal',
            fontStyle: element.properties.italic ? 'italic' : 'normal',
            textAlign: element.properties.alignment || 'left',
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
            console.log('Loading image for canvas:', element.properties.url);
            
            const loadImage = async () => {
              try {
                // Simple, direct image loading
                const img = await Image.fromURL(element.properties.url, {
                  crossOrigin: 'anonymous'
                });
                
                console.log('Image loaded successfully, dimensions:', img.width, 'x', img.height);
                
                // Configure the image for canvas
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
                
                // Set element ID for tracking
                (img as any).elementId = element.id;
                
                // Add to canvas
                fabricCanvas.add(img);
                fabricCanvas.renderAll();
                
                console.log('Image added to canvas successfully');
                toast.success('Image loaded!'); // Only show when first loaded
                
              } catch (error) {
                console.error('Failed to load image:', error);
                
                // Create error placeholder
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
                });
                
                const errorText = new Text('❌ Image Failed\nCheck URL', {
                  left: element.x + element.width / 2,
                  top: element.y + element.height / 2,
                  fontSize: 12,
                  fill: '#d32f2f',
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
                
                toast.error('Failed to load image. Please check the URL.');
              }
            };

            loadImage();
            return;
          }
          break;

        case 'date':
          const formatDate = (format: string) => {
            const now = new Date();
            const day = now.getDate().toString().padStart(2, '0');
            const month = (now.getMonth() + 1).toString().padStart(2, '0');
            const year = now.getFullYear();
            
            switch (format) {
              case 'DD/MM/YYYY':
                return `${day}/${month}/${year}`;
              case 'MM/DD/YYYY':
                return `${month}/${day}/${year}`;
              case 'YYYY-MM-DD':
                return `${year}-${month}-${day}`;
              case 'DD-MM-YYYY':
                return `${day}-${month}-${year}`;
              case 'Month DD, YYYY':
                return now.toLocaleDateString('en-US', { 
                  year: 'numeric', 
                  month: 'long', 
                  day: 'numeric' 
                });
              default:
                return `${day}/${month}/${year}`; // Default to DD/MM/YYYY
            }
          };

          const dateText = element.properties.format 
            ? formatDate(element.properties.format)
            : formatDate('DD/MM/YYYY');

          const dateElement = new Text(dateText, {
            left: element.x,
            top: element.y,
            fontSize: element.properties.fontSize || 16,
            fontFamily: element.properties.fontFamily || 'Arial',
            fill: element.properties.color || '#000000',
            angle: element.rotation,
            fontWeight: element.properties.bold ? 'bold' : 'normal',
            fontStyle: element.properties.italic ? 'italic' : 'normal',
            textAlign: element.properties.alignment || 'left',
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

    // Load elements when design changes (but avoid unnecessary reloads)
    useEffect(() => {
      if (!fabricCanvas) return;

      // Get current objects on canvas
      const currentObjects = fabricCanvas.getObjects();
      const currentElementIds = currentObjects.map(obj => (obj as any).elementId).filter(Boolean);
      const newElementIds = design.elements.map(el => el.id);
      
      // Only clear and reload if elements have actually been added/removed
      const elementsChanged = 
        currentElementIds.length !== newElementIds.length ||
        !currentElementIds.every(id => newElementIds.includes(id)) ||
        !newElementIds.every(id => currentElementIds.includes(id));
      
      if (elementsChanged) {
        console.log('Elements changed, reloading canvas...');
        const activeObject = fabricCanvas.getActiveObject();
        const activeElementId = activeObject ? (activeObject as any).elementId : null;
        
        fabricCanvas.clear();
        design.elements.forEach(addElementToCanvas);
        
        // Restore selection after reload if possible
        setTimeout(() => {
          if (activeElementId) {
            const objects = fabricCanvas.getObjects();
            const objToSelect = objects.find(obj => (obj as any).elementId === activeElementId);
            if (objToSelect) {
              fabricCanvas.setActiveObject(objToSelect);
              fabricCanvas.renderAll();
            }
          }
        }, 100);
      }
    }, [fabricCanvas, design.elements.length, design.elements.map(el => el.id).join(',')]);

    // Separate effect to handle element property updates without reloading
    useEffect(() => {
      if (!fabricCanvas) return;
      
      const objects = fabricCanvas.getObjects();
      
      design.elements.forEach(element => {
        const obj = objects.find(o => (o as any).elementId === element.id);
        if (obj) {
          // Update properties without triggering events
          const isCurrentlyActive = fabricCanvas.getActiveObject() === obj;
          
          obj.set({
            left: element.x,
            top: element.y,
            angle: element.rotation,
            scaleX: element.width / (obj.width || 1),
            scaleY: element.height / (obj.height || 1),
          });
          
          // Update text content if it's a text element
          if (obj.type === 'text' && element.properties?.text !== undefined) {
            (obj as any).set('text', element.properties.text);
          }
          
          // Maintain selection state
          if (isCurrentlyActive) {
            fabricCanvas.setActiveObject(obj);
          }
        }
      });
      
      fabricCanvas.renderAll();
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
          
          // Disable events temporarily to prevent feedback loops
          obj.set('evented', false);
          
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
            
            // Update object coordinates after scaling
            obj.setCoords();
          }
          
          // Update text content if it's a text element
          if (obj.type === 'text' && updates.properties?.text !== undefined) {
            (obj as any).set('text', updates.properties.text);
          }
          
          // Update other text properties
          if (obj.type === 'text' && updates.properties) {
            console.log('🎨 CanvasEditor - Updating text properties:', updates.properties);
            console.log('🎨 CanvasEditor - Current text object properties before update:', {
              fontFamily: (obj as any).fontFamily,
              fontWeight: (obj as any).fontWeight,
              fontStyle: (obj as any).fontStyle,
              fontSize: (obj as any).fontSize,
              fill: (obj as any).fill,
              textAlign: (obj as any).textAlign
            });
            
            if (updates.properties.fontSize !== undefined) {
              obj.set('fontSize', updates.properties.fontSize);
              console.log('🎨 CanvasEditor - Updated fontSize to:', updates.properties.fontSize);
            }
            if (updates.properties.fontFamily !== undefined) {
              obj.set('fontFamily', updates.properties.fontFamily);
              console.log('🎨 CanvasEditor - Updated fontFamily to:', updates.properties.fontFamily);
            }
            if (updates.properties.color !== undefined) {
              obj.set('fill', updates.properties.color);
              console.log('🎨 CanvasEditor - Updated color to:', updates.properties.color);
            }
            if (updates.properties.bold !== undefined) {
              const fontWeight = updates.properties.bold ? 'bold' : 'normal';
              obj.set('fontWeight', fontWeight);
              console.log('🎨 CanvasEditor - Updated fontWeight to:', fontWeight);
            }
            if (updates.properties.italic !== undefined) {
              const fontStyle = updates.properties.italic ? 'italic' : 'normal';  
              obj.set('fontStyle', fontStyle);
              console.log('🎨 CanvasEditor - Updated fontStyle to:', fontStyle);
            }
            if (updates.properties.alignment !== undefined) {
              obj.set('textAlign', updates.properties.alignment);
              console.log('🎨 CanvasEditor - Updated textAlign to:', updates.properties.alignment);
            }
            
            console.log('🎨 CanvasEditor - Text object properties after update:', {
              fontFamily: (obj as any).fontFamily,
              fontWeight: (obj as any).fontWeight,
              fontStyle: (obj as any).fontStyle,
              fontSize: (obj as any).fontSize,
              fill: (obj as any).fill,
              textAlign: (obj as any).textAlign
            });
            
            // Force text re-calculation and immediate re-render
            (obj as any)._clearCache();
            (obj as any).initDimensions();
            obj.setCoords();
            obj.dirty = true;
            fabricCanvas.renderAll();
            fabricCanvas.requestRenderAll();
            
            // Extra render to ensure changes are visible
            setTimeout(() => {
              obj.setCoords();
              fabricCanvas.renderAll();
              fabricCanvas.requestRenderAll();
            }, 10);
          }
          
          // Re-enable events
          obj.set('evented', true);
          
          // Force coordinate update and render
          obj.setCoords();
          fabricCanvas.renderAll();
          
          // Maintain selection if the object was previously selected
          if (wasSelected) {
            fabricCanvas.setActiveObject(obj);
            obj.setCoords(); // Ensure handles are aligned
            fabricCanvas.renderAll();
            
            // Extra alignment step for perfect transform control positioning
            setTimeout(() => {
              obj.setCoords();
              fabricCanvas.requestRenderAll();
              
              // Trigger selection change to update properties panel
              if (onElementSelect) {
                onElementSelect((obj as any).elementId);
              }
            }, 0);
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

      // SIMPLIFIED AND RELIABLE EXPORT METHODS
      exportPDF: async (filename = 'design.pdf') => {
        if (!fabricCanvas) {
          toast.error('Canvas is not ready');
          return;
        }
        
        try {
          console.log('Starting PDF export...');
          toast('Exporting PDF...');
          
          // Clear any active selections to get clean export
          fabricCanvas.discardActiveObject();
          fabricCanvas.renderAll();
          
          // Small delay to ensure render is complete
          await new Promise(resolve => setTimeout(resolve, 200));
          
          // Get exact canvas dimensions
          const canvasWidth = fabricCanvas.getWidth();
          const canvasHeight = fabricCanvas.getHeight();
          
          console.log('Canvas dimensions:', canvasWidth, 'x', canvasHeight);
          
          // Export canvas as image data
          const dataURL = fabricCanvas.toDataURL({
            format: 'png',
            quality: 1,
            multiplier: 1, // Keep 1:1 ratio for exact match
          });
          
          console.log('Canvas exported to data URL, length:', dataURL.length);
          
          // Create PDF with EXACT canvas dimensions
          const pdf = new jsPDF({
            orientation: canvasWidth > canvasHeight ? 'landscape' : 'portrait',
            unit: 'px',
            format: [canvasWidth, canvasHeight]
          });
          
          // Add the canvas image to PDF with exact dimensions
          pdf.addImage(dataURL, 'PNG', 0, 0, canvasWidth, canvasHeight);
          
          // Save the PDF
          pdf.save(filename);
          
          console.log('PDF saved successfully');
          toast.success('PDF exported successfully!');
          
        } catch (error) {
          console.error('PDF export error:', error);
          toast.error('Failed to export PDF. Please try again.');
        }
      },

      exportImage: async (filename = 'design.png') => {
        if (!fabricCanvas) {
          toast.error('Canvas is not ready');
          return;
        }
        
        try {
          console.log('Starting image export...');
          
          // Clear any active selections
          fabricCanvas.discardActiveObject();
          fabricCanvas.renderAll();
          
          await new Promise(resolve => setTimeout(resolve, 100));
          
          const dataURL = fabricCanvas.toDataURL({
            format: 'png',
            quality: 1,
            multiplier: 1,
          });
          
          // Create download link
          const link = document.createElement('a');
          link.download = filename;
          link.href = dataURL;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          
          toast.success('Image exported successfully!');
        } catch (error) {
          console.error('Image export error:', error);
          toast.error('Failed to export image');
        }
      },

      print: async () => {
        if (!fabricCanvas) {
          toast.error('Canvas is not ready');
          return;
        }
        
        try {
          console.log('Starting print...');
          toast('Preparing for print...');
          
          // Clear any active selections
          fabricCanvas.discardActiveObject();
          fabricCanvas.renderAll();
          
          await new Promise(resolve => setTimeout(resolve, 200));
          
          // Get exact canvas dimensions
          const canvasWidth = fabricCanvas.getWidth();
          const canvasHeight = fabricCanvas.getHeight();
          
          // Export canvas as image
          const dataURL = fabricCanvas.toDataURL({
            format: 'png',
            quality: 1,
            multiplier: 1, // Exact 1:1 ratio
          });
          
          console.log('Canvas prepared for print');
          
          // Create PDF for printing with exact dimensions
          const pdf = new jsPDF({
            orientation: canvasWidth > canvasHeight ? 'landscape' : 'portrait',
            unit: 'px',
            format: [canvasWidth, canvasHeight]
          });
          
          pdf.addImage(dataURL, 'PNG', 0, 0, canvasWidth, canvasHeight);
          
          // Create blob and open print dialog
          const pdfBlob = pdf.output('blob');
          const blobURL = URL.createObjectURL(pdfBlob);
          
          // Open in new window for printing
          const printWindow = window.open(blobURL, '_blank');
          
          if (printWindow) {
            printWindow.onload = function() {
              setTimeout(() => {
                printWindow.print();
              }, 500);
            };
            
            // Clean up blob URL after use
            setTimeout(() => {
              URL.revokeObjectURL(blobURL);
            }, 5000);
            
            toast.success('Print dialog opened!');
          } else {
            // Fallback: download if popup blocked
            const link = document.createElement('a');
            link.href = blobURL;
            link.download = 'design-print.pdf';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(blobURL);
            toast.success('PDF downloaded (popup blocked)');
          }
          
        } catch (error) {
          console.error('Print error:', error);
          toast.error('Failed to print. Please try again.');
        }
      },

      generateLiveThumbnail: async () => {
        if (!fabricCanvas) {
          throw new Error('Canvas is not ready');
        }

        // Clear any active selections for clean thumbnail
        fabricCanvas.discardActiveObject();
        fabricCanvas.renderAll();
        
        await new Promise(resolve => setTimeout(resolve, 100));

        // Generate high-quality thumbnail directly from live canvas
        return fabricCanvas.toDataURL({
          format: 'png',
          quality: 1.0,
          multiplier: 2, // Higher resolution for crisp thumbnails
        });
      },

      getCanvasDataURL: async () => {
        if (!fabricCanvas) {
          throw new Error('Canvas is not ready');
        }

        // Clear any active selections
        fabricCanvas.discardActiveObject();
        fabricCanvas.renderAll();
        
        await new Promise(resolve => setTimeout(resolve, 100));

        // Get exact canvas data at full resolution
        return fabricCanvas.toDataURL({
          format: 'png',
          quality: 1.0,
          multiplier: 1, // Exact 1:1 ratio
        });
      }
    }), [fabricCanvas, design.elements]);

    // Register this canvas globally so dashboard can access it
    useEffect(() => {
      if (!fabricCanvas || !design.id) return;
      
      // Clear any existing canvas registration before registering this one
      clearCanvas();
      
      const printFunction = async () => {
        if (!fabricCanvas) {
          toast.error('Canvas is not ready');
          return;
        }
        
        try {
          console.log('🖨️ Starting direct canvas print...');
          toast('Preparing for print...');
          
          // Clear any active selections
          fabricCanvas.discardActiveObject();
          fabricCanvas.renderAll();
          
          await new Promise(resolve => setTimeout(resolve, 200));
          
          // Get exact canvas dimensions
          const canvasWidth = fabricCanvas.getWidth();
          const canvasHeight = fabricCanvas.getHeight();
          
          // Export canvas as image
          const dataURL = fabricCanvas.toDataURL({
            format: 'png',
            quality: 1,
            multiplier: 1, // Exact 1:1 ratio
          });
          
          console.log('Canvas prepared for print');
          
          // Create PDF for printing with exact dimensions
          const pdf = new jsPDF({
            orientation: canvasWidth > canvasHeight ? 'landscape' : 'portrait',
            unit: 'px',
            format: [canvasWidth, canvasHeight]
          });
          
          pdf.addImage(dataURL, 'PNG', 0, 0, canvasWidth, canvasHeight);
          
          // Create blob and open print dialog
          const pdfBlob = pdf.output('blob');
          const blobURL = URL.createObjectURL(pdfBlob);
          
          // Open in new window for printing
          const printWindow = window.open(blobURL, '_blank');
          
          if (printWindow) {
            printWindow.onload = function() {
              setTimeout(() => {
                printWindow.print();
              }, 500);
            };
            
            // Clean up blob URL after use
            setTimeout(() => {
              URL.revokeObjectURL(blobURL);
            }, 5000);
            
            toast.success('Print dialog opened!');
          } else {
            // Fallback: download if popup blocked
            const link = document.createElement('a');
            link.href = blobURL;
            link.download = 'design-print.pdf';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(blobURL);
            toast.success('PDF downloaded (popup blocked)');
          }
          
        } catch (error) {
          console.error('Print error:', error);
          toast.error('Failed to print. Please try again.');
        }
      };
      
      console.log('🎯 Registering canvas globally for design:', design.id);
      registerCanvas(printFunction, fabricCanvas, design.id, true, fabricCanvas); // keepAlive = true, pass fabricCanvas
      
      return () => {
        console.log('🎯 Component unmounting for design:', design.id, '- keeping canvas alive');
        // Don't unregister on unmount, keep it alive for dashboard access
      };
    }, [fabricCanvas, design.id]);

    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-gray-100 p-4">
        <div className="border border-gray-300 shadow-lg relative">
          <canvas ref={canvasRef} />
          {/* Canvas size indicator */}
          <div className="absolute -top-6 left-0 text-xs text-gray-500 bg-white px-2 py-1 rounded border">
            {design.canvasWidth} × {design.canvasHeight}px
          </div>
        </div>
      </div>
    );
  }
);

CanvasEditor.displayName = 'CanvasEditor';

export default CanvasEditor;
