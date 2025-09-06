import { Canvas as FabricCanvas, Text, Image, Rect } from 'fabric';
import jsPDF from 'jspdf';
import { toast } from 'sonner';
import { Design, DesignElement } from '@/components/StickerDesigner';
import { getActiveFabricCanvas, isCanvasAvailable, getCanvasHandle } from './canvasManager';

export const generateCanvasThumbnail = async (design: Design): Promise<string> => {
  console.log('🎯 Starting thumbnail generation for design:', design.name);
  
  // FIRST: Try to use live canvas if available (MOST ACCURATE)
  if (design.id && isCanvasAvailable(design.id)) {
    const liveCanvas = getActiveFabricCanvas();
    if (liveCanvas) {
      console.log('✅ Using LIVE CANVAS for thumbnail - perfect accuracy!');
      toast('Using live canvas for perfect thumbnail...');
      
      try {
        // Clear selections for clean thumbnail
        liveCanvas.discardActiveObject();
        liveCanvas.renderAll();
        
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Generate high-quality thumbnail directly from live canvas
        const dataURL = liveCanvas.toDataURL({
          format: 'png',
          quality: 1.0,
          multiplier: 2, // Higher resolution for crisp thumbnails
        });
        
        console.log('✅ Live canvas thumbnail generated successfully!');
        return dataURL;
      } catch (error) {
        console.warn('⚠️ Live canvas thumbnail failed, falling back to recreation:', error);
        // Fall through to recreation method
      }
    }
  }
  
  // FALLBACK: Recreate canvas from design data
  console.log('⚠️ No live canvas available, recreating from design data');
  toast('Recreating canvas for thumbnail...');
  
  return new Promise((resolve, reject) => {
    try {
      console.log('🔄 Recreating canvas from design data...');
      
      // Calculate exact aspect ratio and high resolution for crisp thumbnails
      const aspectRatio = design.canvasWidth / design.canvasHeight;
      const maxSize = 800; // Very high resolution for crisp display
      
      let thumbnailWidth, thumbnailHeight;
      if (aspectRatio >= 1) {
        // Landscape or square
        thumbnailWidth = maxSize;
        thumbnailHeight = Math.round(maxSize / aspectRatio);
      } else {
        // Portrait
        thumbnailHeight = maxSize;
        thumbnailWidth = Math.round(maxSize * aspectRatio);
      }
      
      console.log('🖼️ Generating high-quality thumbnail:', {
        originalSize: `${design.canvasWidth}×${design.canvasHeight}`,
        thumbnailSize: `${thumbnailWidth}×${thumbnailHeight}`,
        aspectRatio: aspectRatio.toFixed(3),
        elements: design.elements.length
      });
      
      // Create off-screen canvas with perfect dimensions
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = thumbnailWidth;
      tempCanvas.height = thumbnailHeight;
      
      // Temporarily add to DOM for proper font rendering
      tempCanvas.style.position = 'fixed';
      tempCanvas.style.left = '-99999px';
      tempCanvas.style.top = '-99999px';
      tempCanvas.style.visibility = 'hidden';
      document.body.appendChild(tempCanvas);

      const fabricCanvas = new FabricCanvas(tempCanvas, {
        width: thumbnailWidth,
        height: thumbnailHeight,
        backgroundColor: '#ffffff',
        selection: false,
        preserveObjectStacking: true,
        renderOnAddRemove: true,
        allowTouchScrolling: false,
        imageSmoothingEnabled: true,
        enableRetinaScaling: true,
        interactive: false,
        moveCursor: 'default',
        hoverCursor: 'default',
        defaultCursor: 'default',
      });

      // Calculate uniform scale factor to maintain exact proportions
      const scale = Math.min(thumbnailWidth / design.canvasWidth, thumbnailHeight / design.canvasHeight);

      // Add elements with precise scaling and positioning
      const addElementsSequentially = async (elements: DesignElement[], index = 0) => {
        if (index >= elements.length) {
          // All elements added - render final high-quality image
          fabricCanvas.renderAll();
          
          setTimeout(() => {
            try {
              const dataURL = fabricCanvas.toDataURL({
                format: 'png',
                quality: 1.0,
                multiplier: 1, // Already high resolution
                enableRetinaScaling: true,
              });
              
              // Cleanup
              fabricCanvas.dispose();
              if (document.body.contains(tempCanvas)) {
                document.body.removeChild(tempCanvas);
              }
              
              console.log('✅ High-quality thumbnail generated successfully');
              resolve(dataURL);
            } catch (error) {
              console.error('❌ Failed to generate thumbnail dataURL:', error);
              fabricCanvas.dispose();
              if (document.body.contains(tempCanvas)) {
                document.body.removeChild(tempCanvas);
              }
              reject(error);
            }
          }, 400); // Generous time for rendering
          return;
        }

        const element = elements[index];
        console.log(`📝 Adding element ${index + 1}/${elements.length}: ${element.type}`);
        
        try {
          switch (element.type) {
            case 'text':
              const textObj = new Text(element.properties.text || 'Text', {
                left: element.x * scale,
                top: element.y * scale,
                fontSize: (element.properties.fontSize || 16) * scale,
                fontFamily: element.properties.fontFamily || 'Arial',
                fill: element.properties.color || '#000000',
                angle: element.rotation || 0,
                fontWeight: element.properties.bold ? 'bold' : 'normal',
                fontStyle: element.properties.italic ? 'italic' : 'normal',
                textAlign: element.properties.alignment || 'left',
                selectable: false,
                evented: false,
                hoverCursor: 'default',
                moveCursor: 'default',
              });
              fabricCanvas.add(textObj);
              break;

            case 'image':
              if (element.properties.url) {
                try {
                  const imgObj = await Image.fromURL(element.properties.url, {
                    crossOrigin: 'anonymous'
                  });
                  
                  imgObj.set({
                    left: element.x * scale,
                    top: element.y * scale,
                    scaleX: (element.width / (imgObj.width || 1)) * scale,
                    scaleY: (element.height / (imgObj.height || 1)) * scale,
                    angle: element.rotation || 0,
                    selectable: false,
                    evented: false,
                    hoverCursor: 'default',
                    moveCursor: 'default',
                  });
                  
                  fabricCanvas.add(imgObj);
                } catch (error) {
                  console.warn('Failed to load image for thumbnail, adding placeholder:', error);
                  // Add a clean placeholder
                  const placeholder = new Rect({
                    left: element.x * scale,
                    top: element.y * scale,
                    width: element.width * scale,
                    height: element.height * scale,
                    fill: '#f8f9fa',
                    stroke: '#dee2e6',
                    strokeWidth: 1 * scale,
                    angle: element.rotation || 0,
                    selectable: false,
                    evented: false,
                    rx: 4 * scale,
                    ry: 4 * scale,
                  });
                  fabricCanvas.add(placeholder);
                  
                  // Add placeholder text
                  const placeholderText = new Text('📷', {
                    left: (element.x + element.width / 2) * scale,
                    top: (element.y + element.height / 2) * scale,
                    fontSize: Math.min(element.width, element.height) * scale * 0.3,
                    fill: '#6c757d',
                    originX: 'center',
                    originY: 'center',
                    selectable: false,
                    evented: false,
                  });
                  fabricCanvas.add(placeholderText);
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
                angle: element.rotation || 0,
                fontWeight: element.properties.bold ? 'bold' : 'normal',
                fontStyle: element.properties.italic ? 'italic' : 'normal',
                textAlign: element.properties.alignment || 'left',
                selectable: false,
                evented: false,
                hoverCursor: 'default',
                moveCursor: 'default',
              });
              fabricCanvas.add(dateElement);
              break;
          }
        } catch (error) {
          console.warn('Failed to add element to thumbnail:', error);
        }

        // Continue with next element after a short delay for proper rendering
        setTimeout(() => {
          addElementsSequentially(elements, index + 1);
        }, 100); // Allow time for each element to fully render
      };

      if (design.elements.length === 0) {
        // No elements, return clean empty canvas
        setTimeout(() => {
          try {
            const dataURL = fabricCanvas.toDataURL({
              format: 'png',
              quality: 1.0,
              multiplier: 1,
              enableRetinaScaling: true,
            });
            fabricCanvas.dispose();
            if (document.body.contains(tempCanvas)) {
              document.body.removeChild(tempCanvas);
            }
            resolve(dataURL);
          } catch (error) {
            fabricCanvas.dispose();
            if (document.body.contains(tempCanvas)) {
              document.body.removeChild(tempCanvas);
            }
            reject(error);
          }
        }, 200);
      } else {
        addElementsSequentially(design.elements);
      }

    } catch (error) {
      reject(error);
    }
  });
};

export const printDesign = async (design: Design): Promise<void> => {
  console.log('🖨️ Starting print for design:', design.id);
  
  // FIRST: Try to use canvas handle's direct print method (MOST RELIABLE)
  if (design.id && isCanvasAvailable(design.id)) {
    const canvasHandle = getCanvasHandle();
    if (canvasHandle && canvasHandle.print) {
      console.log('✅ Using CANVAS HANDLE for print - most reliable!');
      toast('Using direct canvas print for perfect quality...');
      
      try {
        await canvasHandle.print();
        console.log('🎉 Canvas handle print completed successfully!');
        toast.success('🖨️ Perfect quality print dialog opened!');
        return;
      } catch (error) {
        console.warn('⚠️ Canvas handle print failed, trying fabric canvas:', error);
        toast.error('Direct print failed, trying alternative...');
        // Fall through to next method
      }
    }
  }
  
  // SECOND: Try to use live fabric canvas if available
  if (design.id && isCanvasAvailable(design.id)) {
    const liveCanvas = getActiveFabricCanvas();
    if (liveCanvas) {
      console.log('✅ Using LIVE FABRIC CANVAS for print - perfect accuracy!');
      toast('Using live fabric canvas for perfect print quality...');
      
      try {
        // Clear any active selections
        liveCanvas.discardActiveObject();
        liveCanvas.renderAll();
        
        await new Promise(resolve => setTimeout(resolve, 200));
        
        // Get exact canvas dimensions
        const canvasWidth = liveCanvas.getWidth();
        const canvasHeight = liveCanvas.getHeight();
        
        console.log('📐 Live canvas dimensions:', canvasWidth, 'x', canvasHeight);
        
        // Export canvas as image with maximum quality
        const dataURL = liveCanvas.toDataURL({
          format: 'png',
          quality: 1,
          multiplier: 1,
        });
        
        console.log('✅ Live canvas exported for print');
        console.log('🔍 DataURL length:', dataURL.length);
        console.log('🔍 DataURL preview:', dataURL.substring(0, 100));
        
        // Check if dataURL is valid
        if (!dataURL || dataURL.length < 100 || dataURL === 'data:,') {
          throw new Error('Canvas export failed - empty or invalid dataURL');
        }
        
        // Create PDF for printing
        const pdf = new jsPDF({
          orientation: canvasWidth > canvasHeight ? 'landscape' : 'portrait',
          unit: 'px',
          format: [canvasWidth, canvasHeight]
        });
        
        // Add the image to PDF
        try {
          pdf.addImage(dataURL, 'PNG', 0, 0, canvasWidth, canvasHeight);
        } catch (pdfError) {
          console.error('❌ PDF creation failed:', pdfError);
          throw new Error('Failed to create PDF from canvas');
        }
        
        // Create blob and open print dialog
        const pdfBlob = pdf.output('blob');
        const blobURL = URL.createObjectURL(pdfBlob);
        
        console.log('🖨️ Opening print dialog...');
        
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
          
          toast.success('🖨️ Perfect quality print dialog opened!');
        } else {
          // Fallback: download if popup blocked
          const link = document.createElement('a');
          link.href = blobURL;
          link.download = `${design.name || 'design'}-print.pdf`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(blobURL);
          toast.success('📥 Perfect quality PDF downloaded (popup blocked)');
        }
        
        console.log('🎉 Live canvas print completed successfully!');
        return;
        
      } catch (error) {
        console.warn('⚠️ Live canvas print failed, falling back to recreation:', error);
        toast.error('Live canvas failed, trying recreation...');
        // Fall through to recreation method
      }
    }
  }
  
  // FALLBACK: Recreate canvas from design data
  console.log('⚠️ No live canvas available, recreating from design data');
  toast('Recreating canvas for print...');
  
  return new Promise(async (resolve, reject) => {
    try {
      console.log('� Recreating canvas from design data for print...');
      console.log('📐 Canvas dimensions:', design.canvasWidth, 'x', design.canvasHeight);
      console.log('📋 Elements to render:', design.elements.length);
      
      toast('Creating canvas for print...');

      // Create a temporary canvas with exact dimensions
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = design.canvasWidth;
      tempCanvas.height = design.canvasHeight;
      
      // Add to DOM for proper rendering (hidden)
      tempCanvas.style.position = 'fixed';
      tempCanvas.style.left = '-9999px';
      tempCanvas.style.top = '-9999px';
      document.body.appendChild(tempCanvas);

      // Create Fabric canvas with EXACT same settings as CanvasEditor
      const fabricCanvas = new FabricCanvas(tempCanvas, {
        width: design.canvasWidth,
        height: design.canvasHeight,
        backgroundColor: '#ffffff',
        selection: false, // Disable for print
        preserveObjectStacking: true,
        renderOnAddRemove: true,
        allowTouchScrolling: false,
        imageSmoothingEnabled: true,
        enableRetinaScaling: true,
        interactive: false, // Disable for print
        moveCursor: 'default',
        hoverCursor: 'default',
        defaultCursor: 'default',
      });

      console.log('✅ Canvas created, adding elements...');

      // Add ALL elements using EXACT same logic as CanvasEditor
      const addedElements: any[] = [];
      
      for (let i = 0; i < design.elements.length; i++) {
        const element = design.elements[i];
        console.log(`📝 Adding element ${i + 1}/${design.elements.length}: ${element.type} (${element.id})`);
        
        try {
          switch (element.type) {
            case 'text':
              console.log('  📝 Text content:', element.properties.text);
              console.log('  📝 Text position:', element.x, element.y);
              console.log('  📝 Text properties:', {
                fontSize: element.properties.fontSize,
                fontFamily: element.properties.fontFamily,
                color: element.properties.color,
                bold: element.properties.bold,
                italic: element.properties.italic,
                alignment: element.properties.alignment
              });
              
              const textObj = new Text(element.properties.text || 'Sample Text', {
                left: element.x,
                top: element.y,
                fontSize: element.properties.fontSize || 16,
                fontFamily: element.properties.fontFamily || 'Arial',
                fill: element.properties.color || '#000000',
                angle: element.rotation || 0,
                fontWeight: element.properties.bold ? 'bold' : 'normal',
                fontStyle: element.properties.italic ? 'italic' : 'normal',
                textAlign: element.properties.alignment || 'left',
                // For printing - no interaction needed
                selectable: false,
                evented: false,
              });
              
              fabricCanvas.add(textObj);
              addedElements.push({ type: 'text', obj: textObj });
              console.log('  ✅ Text element added successfully');
              break;

            case 'image':
              if (element.properties.url) {
                console.log('  🖼️ Loading image:', element.properties.url);
                console.log('  🖼️ Image position:', element.x, element.y);
                console.log('  🖼️ Image dimensions:', element.width, element.height);
                
                try {
                  const img = await Image.fromURL(element.properties.url, {
                    crossOrigin: 'anonymous'
                  });
                  
                  console.log('  🖼️ Image loaded, natural size:', img.width, 'x', img.height);
                  
                  img.set({
                    left: element.x,
                    top: element.y,
                    scaleX: element.width / (img.width || 1),
                    scaleY: element.height / (img.height || 1),
                    angle: element.rotation || 0,
                    selectable: false,
                    evented: false,
                  });
                  
                  fabricCanvas.add(img);
                  addedElements.push({ type: 'image', obj: img });
                  console.log('  ✅ Image element added successfully');
                  
                } catch (imageError) {
                  console.error('  ❌ Failed to load image:', imageError);
                  
                  // Add placeholder like CanvasEditor does
                  const placeholder = new Rect({
                    left: element.x,
                    top: element.y,
                    width: element.width,
                    height: element.height,
                    fill: '#ffebee',
                    stroke: '#f44336',
                    strokeWidth: 2,
                    strokeDashArray: [10, 5],
                    angle: element.rotation || 0,
                    selectable: false,
                    evented: false,
                  });
                  
                  fabricCanvas.add(placeholder);
                  addedElements.push({ type: 'placeholder', obj: placeholder });
                  console.log('  ⚠️ Image placeholder added instead');
                }
              }
              break;

            case 'date':
              console.log('  📅 Adding date element');
              console.log('  📅 Date position:', element.x, element.y);
              console.log('  📅 Date format:', element.properties.format);
              
              // Generate current date
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
              
              console.log('  📅 Generated date text:', dateText);

              const dateObj = new Text(dateText, {
                left: element.x,
                top: element.y,
                fontSize: element.properties.fontSize || 16,
                fontFamily: element.properties.fontFamily || 'Arial',
                fill: element.properties.color || '#000000',
                angle: element.rotation || 0,
                fontWeight: element.properties.bold ? 'bold' : 'normal',
                fontStyle: element.properties.italic ? 'italic' : 'normal',
                textAlign: element.properties.alignment || 'left',
                selectable: false,
                evented: false,
              });
              
              fabricCanvas.add(dateObj);
              addedElements.push({ type: 'date', obj: dateObj });
              console.log('  ✅ Date element added successfully');
              break;

            default:
              console.warn('  ⚠️ Unknown element type:', element.type);
          }
        } catch (elementError) {
          console.error(`  ❌ Failed to add element ${element.type}:`, elementError);
        }
        
        // Small delay between elements for proper rendering
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      console.log(`✅ All elements added! Total: ${addedElements.length}`);
      
      // Force final render
      fabricCanvas.renderAll();
      
      // Wait for everything to be properly rendered
      console.log('⏳ Waiting for final render...');
      await new Promise(resolve => setTimeout(resolve, 500));

      // Now export and print using EXACT same logic as CanvasEditor
      try {
        console.log('📤 Starting export for print...');
        
        // Clear any selections (same as CanvasEditor)
        fabricCanvas.discardActiveObject();
        fabricCanvas.renderAll();
        
        await new Promise(resolve => setTimeout(resolve, 200));
        
        // Get exact canvas dimensions (same as CanvasEditor)
        const canvasWidth = fabricCanvas.getWidth();
        const canvasHeight = fabricCanvas.getHeight();
        
        console.log('📐 Final canvas dimensions for export:', canvasWidth, 'x', canvasHeight);
        
        // Export canvas as image (same as CanvasEditor)
        const dataURL = fabricCanvas.toDataURL({
          format: 'png',
          quality: 1,
          multiplier: 1, // Exact 1:1 ratio
        });
        
        console.log('✅ Canvas exported to image, size:', dataURL.length, 'characters');
        
        // Create PDF for printing with exact dimensions (same as CanvasEditor)
        const pdf = new jsPDF({
          orientation: canvasWidth > canvasHeight ? 'landscape' : 'portrait',
          unit: 'px',
          format: [canvasWidth, canvasHeight]
        });
        
        pdf.addImage(dataURL, 'PNG', 0, 0, canvasWidth, canvasHeight);
        
        // Create blob and open print dialog (same as CanvasEditor)
        const pdfBlob = pdf.output('blob');
        const blobURL = URL.createObjectURL(pdfBlob);
        
        console.log('🖨️ Opening print dialog...');
        
        // Open in new window for printing (same as CanvasEditor)
        const printWindow = window.open(blobURL, '_blank');
        
        if (printWindow) {
          printWindow.onload = function() {
            setTimeout(() => {
              printWindow.print();
            }, 500);
          };
          
          // Clean up blob URL after use (same as CanvasEditor)
          setTimeout(() => {
            URL.revokeObjectURL(blobURL);
          }, 5000);
          
          toast.success('🖨️ Print dialog opened successfully!');
        } else {
          // Fallback: download if popup blocked (same as CanvasEditor)
          const link = document.createElement('a');
          link.href = blobURL;
          link.download = `${design.name || 'design'}-print.pdf`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(blobURL);
          toast.success('📥 PDF downloaded (popup blocked)');
        }
        
        // Clean up
        fabricCanvas.dispose();
        document.body.removeChild(tempCanvas);
        
        console.log('🎉 Print completed successfully!');
        resolve();
        
      } catch (exportError) {
        fabricCanvas.dispose();
        document.body.removeChild(tempCanvas);
        throw exportError;
      }

    } catch (error) {
      console.error('❌ Print failed:', error);
      toast.error('Print failed: ' + (error.message || 'Unknown error'));
      reject(error);
    }
  });
};
