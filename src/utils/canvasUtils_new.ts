import { Canvas as FabricCanvas, Text, Image, Rect } from 'fabric';
import jsPDF from 'jspdf';
import { toast } from 'sonner';
import { Design, DesignElement } from '@/components/StickerDesigner';

export const generateCanvasThumbnail = async (design: Design): Promise<string> => {
  return new Promise((resolve, reject) => {
    try {
      // Create a temporary canvas
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = 200; // Thumbnail size
      tempCanvas.height = 150; // Thumbnail size
      
      const fabricCanvas = new FabricCanvas(tempCanvas, {
        width: 200,
        height: 150,
        backgroundColor: '#ffffff',
      });

      // Calculate scale factors to fit the design into thumbnail
      const scaleX = 200 / design.canvasWidth;
      const scaleY = 150 / design.canvasHeight;
      const scale = Math.min(scaleX, scaleY);

      // Add elements to canvas
      const addElementsRecursively = async (elements: DesignElement[], index = 0) => {
        if (index >= elements.length) {
          // All elements added, generate thumbnail
          setTimeout(() => {
            const dataURL = fabricCanvas.toDataURL({
              format: 'png',
              quality: 0.8,
              multiplier: 1,
            });
            fabricCanvas.dispose();
            resolve(dataURL);
          }, 100);
          return;
        }

        const element = elements[index];
        
        try {
          switch (element.type) {
            case 'text':
              const text = new Text(element.properties.text || 'Text', {
                left: element.x * scale,
                top: element.y * scale,
                fontSize: (element.properties.fontSize || 16) * scale,
                fontFamily: element.properties.fontFamily || 'Arial',
                fill: element.properties.color || '#000000',
                angle: element.rotation,
                fontWeight: element.properties.bold ? 'bold' : 'normal',
                fontStyle: element.properties.italic ? 'italic' : 'normal',
                textAlign: element.properties.alignment || 'left',
                scaleX: scale,
                scaleY: scale,
              });
              fabricCanvas.add(text);
              break;

            case 'image':
              if (element.properties.url) {
                try {
                  const img = await Image.fromURL(element.properties.url, {
                    crossOrigin: 'anonymous'
                  });
                  
                  img.set({
                    left: element.x * scale,
                    top: element.y * scale,
                    scaleX: (element.width / (img.width || 1)) * scale,
                    scaleY: (element.height / (img.height || 1)) * scale,
                    angle: element.rotation,
                  });
                  
                  fabricCanvas.add(img);
                } catch (error) {
                  console.warn('Failed to load image for thumbnail:', error);
                }
              }
              break;

            case 'date':
              const now = new Date();
              const day = String(now.getDate()).padStart(2, '0');
              const month = String(now.getMonth() + 1).padStart(2, '0');
              const year = now.getFullYear();
              
              const formatDate = (format: string) => {
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
                    return `${day}/${month}/${year}`;
                }
              };

              const dateText = element.properties.format 
                ? formatDate(element.properties.format)
                : formatDate('DD/MM/YYYY');

              const dateElement = new Text(dateText, {
                left: element.x * scale,
                top: element.y * scale,
                fontSize: (element.properties.fontSize || 16) * scale,
                fontFamily: element.properties.fontFamily || 'Arial',
                fill: element.properties.color || '#000000',
                angle: element.rotation,
                fontWeight: element.properties.bold ? 'bold' : 'normal',
                fontStyle: element.properties.italic ? 'italic' : 'normal',
                textAlign: element.properties.alignment || 'left',
                scaleX: scale,
                scaleY: scale,
              });
              fabricCanvas.add(dateElement);
              break;
          }
        } catch (error) {
          console.warn('Failed to add element to thumbnail:', error);
        }

        // Continue with next element
        setTimeout(() => {
          addElementsRecursively(elements, index + 1);
        }, 10);
      };

      if (design.elements.length === 0) {
        // No elements, just return empty canvas
        setTimeout(() => {
          const dataURL = fabricCanvas.toDataURL({
            format: 'png',
            quality: 0.8,
            multiplier: 1,
          });
          fabricCanvas.dispose();
          resolve(dataURL);
        }, 100);
      } else {
        addElementsRecursively(design.elements);
      }

    } catch (error) {
      reject(error);
    }
  });
};

export const printDesign = async (design: Design): Promise<void> => {
  return new Promise(async (resolve, reject) => {
    try {
      console.log('🖨️ Starting FIXED canvas print...');
      toast('Preparing for print...');

      // Create temporary canvas with EXACT dimensions
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = design.canvasWidth;
      tempCanvas.height = design.canvasHeight;
      
      const fabricCanvas = new FabricCanvas(tempCanvas, {
        width: design.canvasWidth,
        height: design.canvasHeight,
        backgroundColor: '#ffffff',
      });

      // Use Fabric.js JSON serialization for EXACT recreation
      const canvasJSON = {
        version: "5.3.0",
        objects: design.elements.map(element => {
          switch (element.type) {
            case 'text':
              return {
                type: 'text',
                version: "5.3.0",
                originX: "left",
                originY: "top",
                left: element.x,
                top: element.y,
                width: element.width || 100,
                height: element.height || 20,
                fill: element.properties.color || '#000000',
                stroke: null,
                strokeWidth: 1,
                scaleX: 1,
                scaleY: 1,
                angle: element.rotation || 0,
                flipX: false,
                flipY: false,
                opacity: 1,
                visible: true,
                text: element.properties.text || 'Sample Text',
                fontSize: element.properties.fontSize || 16,
                fontWeight: element.properties.bold ? 'bold' : 'normal',
                fontFamily: element.properties.fontFamily || 'Arial',
                fontStyle: element.properties.italic ? 'italic' : 'normal',
                lineHeight: 1.16,
                textAlign: element.properties.alignment || 'left',
                charSpacing: 0,
                styles: {},
                direction: "ltr"
              };
            
            case 'date':
              // Generate current date
              const now = new Date();
              const day = String(now.getDate()).padStart(2, '0');
              const month = String(now.getMonth() + 1).padStart(2, '0');
              const year = now.getFullYear();
              
              const formatDate = (format: string) => {
                switch (format) {
                  case 'DD/MM/YYYY': return `${day}/${month}/${year}`;
                  case 'MM/DD/YYYY': return `${month}/${day}/${year}`;
                  case 'YYYY-MM-DD': return `${year}-${month}-${day}`;
                  case 'DD-MM-YYYY': return `${day}-${month}-${year}`;
                  case 'Month DD, YYYY': return now.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
                  default: return `${day}/${month}/${year}`;
                }
              };

              const dateText = element.properties.format ? formatDate(element.properties.format) : formatDate('DD/MM/YYYY');

              return {
                type: 'text',
                version: "5.3.0",
                originX: "left",
                originY: "top",
                left: element.x,
                top: element.y,
                width: element.width || 100,
                height: element.height || 20,
                fill: element.properties.color || '#000000',
                stroke: null,
                strokeWidth: 1,
                scaleX: 1,
                scaleY: 1,
                angle: element.rotation || 0,
                flipX: false,
                flipY: false,
                opacity: 1,
                visible: true,
                text: dateText,
                fontSize: element.properties.fontSize || 16,
                fontWeight: element.properties.bold ? 'bold' : 'normal',
                fontFamily: element.properties.fontFamily || 'Arial',
                fontStyle: element.properties.italic ? 'italic' : 'normal',
                lineHeight: 1.16,
                textAlign: element.properties.alignment || 'left',
                charSpacing: 0,
                styles: {},
                direction: "ltr"
              };

            case 'image':
              if (element.properties.url) {
                return {
                  type: 'image',
                  version: "5.3.0",
                  originX: "left",
                  originY: "top",
                  left: element.x,
                  top: element.y,
                  width: element.width,
                  height: element.height,
                  fill: "rgb(0,0,0)",
                  stroke: null,
                  strokeWidth: 0,
                  scaleX: 1,
                  scaleY: 1,
                  angle: element.rotation || 0,
                  flipX: false,
                  flipY: false,
                  opacity: 1,
                  visible: true,
                  crossOrigin: "anonymous",
                  src: element.properties.url,
                  filters: []
                };
              }
              return null;

            default:
              return null;
          }
        }).filter(obj => obj !== null)
      };

      console.log('📋 Loading canvas from JSON data...');
      
      // Load canvas using Fabric's JSON loader for exact recreation
      fabricCanvas.loadFromJSON(canvasJSON, () => {
        console.log('✅ Canvas loaded successfully!');
        fabricCanvas.renderAll();
        
        // Wait for images to load, then print
        setTimeout(async () => {
          try {
            // EXACT same print logic as CanvasEditor
            fabricCanvas.discardActiveObject();
            fabricCanvas.renderAll();
            
            await new Promise(resolve => setTimeout(resolve, 200));
            
            const canvasWidth = fabricCanvas.getWidth();
            const canvasHeight = fabricCanvas.getHeight();
            
            const dataURL = fabricCanvas.toDataURL({
              format: 'png',
              quality: 1,
              multiplier: 1,
            });
            
            console.log('🎯 Canvas exported for print');
            
            const pdf = new jsPDF({
              orientation: canvasWidth > canvasHeight ? 'landscape' : 'portrait',
              unit: 'px',
              format: [canvasWidth, canvasHeight]
            });
            
            pdf.addImage(dataURL, 'PNG', 0, 0, canvasWidth, canvasHeight);
            
            const pdfBlob = pdf.output('blob');
            const blobURL = URL.createObjectURL(pdfBlob);
            
            const printWindow = window.open(blobURL, '_blank');
            
            if (printWindow) {
              printWindow.onload = function() {
                setTimeout(() => {
                  printWindow.print();
                }, 500);
              };
              
              setTimeout(() => {
                URL.revokeObjectURL(blobURL);
              }, 5000);
              
              toast.success('🖨️ Print dialog opened!');
            } else {
              const link = document.createElement('a');
              link.href = blobURL;
              link.download = 'design-print.pdf';
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
              URL.revokeObjectURL(blobURL);
              toast.success('📥 PDF downloaded (popup blocked)');
            }
            
            fabricCanvas.dispose();
            resolve();
          } catch (error) {
            fabricCanvas.dispose();
            reject(error);
          }
        }, 1000); // Wait longer for images to load
      });

    } catch (error) {
      console.error('❌ Print failed:', error);
      toast.error('Print failed: ' + error.message);
      reject(error);
    }
  });
};
