import { toast } from 'sonner';
import type { CanvasEditorHandle } from '@/components/canvas/CanvasEditor';

// Global canvas manager to share canvas instances between components
export interface CanvasManager {
  printFunction: (() => Promise<void>) | null;
  canvasRef: any;
  designId: string | null;
  keepAlive: boolean; // Flag to keep canvas registered even when component unmounts
  fabricCanvas: any | null; // Store reference to actual fabric canvas
  canvasHandle: CanvasEditorHandle | null; // Store the canvas handle for direct access
}

// Global canvas manager instance
const canvasManager: CanvasManager = {
  printFunction: null,
  canvasRef: null,
  designId: null,
  keepAlive: false,
  fabricCanvas: null,
  canvasHandle: null,
};

// Register the canvas and its print function
export const registerCanvas = (printFn: () => Promise<void>, canvasRef: any, designId: string, keepAlive: boolean = true, fabricCanvas: any = null, canvasHandle: CanvasEditorHandle | null = null) => {
  console.log('🎯 Registering canvas for design:', designId, 'keepAlive:', keepAlive);
  canvasManager.printFunction = printFn;
  canvasManager.canvasRef = canvasRef;
  canvasManager.designId = designId;
  canvasManager.keepAlive = keepAlive;
  canvasManager.fabricCanvas = fabricCanvas;
  canvasManager.canvasHandle = canvasHandle;
};

// Unregister the canvas (only if not keeping alive or switching to different design)
export const unregisterCanvas = (force: boolean = false) => {
  if (!force && canvasManager.keepAlive) {
    console.log('🎯 Canvas kept alive, not unregistering');
    return;
  }
  
  console.log('🎯 Unregistering canvas');
  canvasManager.printFunction = null;
  canvasManager.canvasRef = null;
  canvasManager.designId = null;
  canvasManager.keepAlive = false;
  canvasManager.fabricCanvas = null;
  canvasManager.canvasHandle = null;
};

// Force clear when opening a new design
export const clearCanvas = () => {
  console.log('🎯 Force clearing canvas');
  unregisterCanvas(true);
};

// Print the currently registered canvas
export const printCurrentCanvas = async (designId: string): Promise<void> => {
  console.log('🖨️ Attempting to print canvas for design:', designId);
  
  if (!canvasManager.printFunction) {
    throw new Error('No canvas is currently active. Please open the design in the editor first.');
  }
  
  if (canvasManager.designId !== designId) {
    throw new Error(`Canvas mismatch. Expected design ${designId}, but active canvas is for design ${canvasManager.designId}`);
  }
  
  console.log('✅ Found active canvas, printing...');
  return canvasManager.printFunction();
};

// Check if a canvas is available for a specific design
export const isCanvasAvailable = (designId: string): boolean => {
  return canvasManager.printFunction !== null && canvasManager.designId === designId;
};

// Get the current canvas info
export const getCurrentCanvasInfo = () => {
  return {
    isAvailable: canvasManager.printFunction !== null,
    designId: canvasManager.designId,
    keepAlive: canvasManager.keepAlive,
    hasFabricCanvas: canvasManager.fabricCanvas !== null,
  };
};

// Get direct access to fabric canvas for debugging/inspection
export const getActiveFabricCanvas = () => {
  return canvasManager.fabricCanvas;
};

// Get the canvas handle for direct method access
export const getCanvasHandle = (): CanvasEditorHandle | null => {
  return canvasManager.canvasHandle;
};

// Generate thumbnail directly from live canvas (MOST ACCURATE)
export const generateLiveThumbnail = async (designId: string): Promise<string> => {
  if (!canvasManager.canvasHandle) {
    throw new Error('No active canvas handle available');
  }
  
  if (canvasManager.designId !== designId) {
    throw new Error(`Canvas mismatch. Expected design ${designId}, but active canvas is for design ${canvasManager.designId}`);
  }
  
  console.log('✅ Generating thumbnail from live canvas');
  return canvasManager.canvasHandle.generateLiveThumbnail();
};

// Print directly using canvas handle (MOST ACCURATE)
export const printFromCanvasHandle = async (designId: string): Promise<void> => {
  if (!canvasManager.canvasHandle) {
    throw new Error('No active canvas handle available');
  }
  
  if (canvasManager.designId !== designId) {
    throw new Error(`Canvas mismatch. Expected design ${designId}, but active canvas is for design ${canvasManager.designId}`);
  }
  
  console.log('✅ Printing from canvas handle');
  return canvasManager.canvasHandle.print();
};

// Print directly from active fabric canvas with maximum accuracy
export const printFromActiveFabricCanvas = async (designId: string): Promise<void> => {
  console.log('🖨️ Attempting direct fabric canvas print for design:', designId);
  
  if (!canvasManager.fabricCanvas) {
    throw new Error('No active fabric canvas available');
  }
  
  if (canvasManager.designId !== designId) {
    throw new Error(`Canvas mismatch. Expected design ${designId}, but active canvas is for design ${canvasManager.designId}`);
  }
  
  const fabricCanvas = canvasManager.fabricCanvas;
  
  console.log('✅ Using direct fabric canvas access for print');
  console.log('📊 Canvas objects:', fabricCanvas.getObjects().length);
  
  toast('Using active canvas for perfect print quality...');
  
  // Clear selections and render
  fabricCanvas.discardActiveObject();
  fabricCanvas.renderAll();
  
  await new Promise(resolve => setTimeout(resolve, 200));
  
  // Get exact canvas dimensions
  const canvasWidth = fabricCanvas.getWidth();
  const canvasHeight = fabricCanvas.getHeight();
  
  console.log('📐 Canvas dimensions:', canvasWidth, 'x', canvasHeight);
  
  // Export canvas as image with maximum quality
  const dataURL = fabricCanvas.toDataURL({
    format: 'png',
    quality: 1,
    multiplier: 1,
  });
  
  console.log('✅ Canvas exported to image');
  
  // Create PDF for printing
  const jsPDF = (await import('jspdf')).default;
  const pdf = new jsPDF({
    orientation: canvasWidth > canvasHeight ? 'landscape' : 'portrait',
    unit: 'px',
    format: [canvasWidth, canvasHeight]
  });
  
  pdf.addImage(dataURL, 'PNG', 0, 0, canvasWidth, canvasHeight);
  
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
    
    toast.success('🖨️ Print dialog opened with perfect canvas quality!');
  } else {
    // Fallback: download if popup blocked
    const link = document.createElement('a');
    link.href = blobURL;
    link.download = `design-${designId}-print.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(blobURL);
    toast.success('📥 Perfect quality PDF downloaded (popup blocked)');
  }
};

// Debug function to compare active canvas with design data
export const debugCanvasVsDesign = (design: any) => {
  if (!canvasManager.fabricCanvas) {
    console.log('❌ No active fabric canvas for comparison');
    return;
  }
  
  const fabricCanvas = canvasManager.fabricCanvas;
  const canvasObjects = fabricCanvas.getObjects();
  
  console.log('🔍 CANVAS vs DESIGN COMPARISON:');
  console.log('📊 Canvas objects count:', canvasObjects.length);
  console.log('📊 Design elements count:', design.elements.length);
  
  canvasObjects.forEach((obj: any, index: number) => {
    const designElement = design.elements[index];
    
    if (obj.type === 'text' || obj.type === 'i-text') {
      console.log(`📝 TEXT ELEMENT ${index}:`);
      console.log('  Canvas:', {
        text: obj.text,
        left: obj.left,
        top: obj.top,
        fontSize: obj.fontSize,
        fontFamily: obj.fontFamily,
        fill: obj.fill,
        angle: obj.angle
      });
      
      if (designElement) {
        console.log('  Design:', {
          text: designElement.properties.text,
          left: designElement.x,
          top: designElement.y,
          fontSize: designElement.properties.fontSize,
          fontFamily: designElement.properties.fontFamily,
          fill: designElement.properties.color,
          angle: designElement.rotation
        });
        
        // Check for discrepancies
        if (Math.abs(obj.left - designElement.x) > 1) {
          console.warn('  ⚠️ X position mismatch:', obj.left, 'vs', designElement.x);
        }
        if (Math.abs(obj.top - designElement.y) > 1) {
          console.warn('  ⚠️ Y position mismatch:', obj.top, 'vs', designElement.y);
        }
        if (obj.fontSize !== designElement.properties.fontSize) {
          console.warn('  ⚠️ Font size mismatch:', obj.fontSize, 'vs', designElement.properties.fontSize);
        }
      }
    }
  });
};
