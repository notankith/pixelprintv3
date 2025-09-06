import jsPDF from 'jspdf';
import { toast } from 'sonner';
import { Design } from '@/components/StickerDesigner';

export const simplePrintDesign = async (design: Design): Promise<void> => {
  console.log('🖨️ Simple print for design:', design.id);
  
  try {
    // Create a simple HTML5 Canvas
    const canvas = document.createElement('canvas');
    canvas.width = design.canvasWidth || 400;
    canvas.height = design.canvasHeight || 400;
    const ctx = canvas.getContext('2d');
    
    if (!ctx) {
      throw new Error('Failed to get canvas context');
    }
    
    // Fill with white background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Add some simple text for testing
    ctx.fillStyle = '#000000';
    ctx.font = '20px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Test Print', canvas.width / 2, canvas.height / 2);
    ctx.fillText(design.name || 'Untitled', canvas.width / 2, canvas.height / 2 + 30);
    
    console.log('✅ Simple canvas created');
    
    // Convert to dataURL
    const dataURL = canvas.toDataURL('image/png', 1.0);
    
    if (!dataURL || dataURL.length < 100) {
      throw new Error('Canvas export failed');
    }
    
    console.log('✅ Canvas exported, creating PDF...');
    
    // Create PDF
    const pdf = new jsPDF({
      orientation: canvas.width > canvas.height ? 'landscape' : 'portrait',
      unit: 'px',
      format: [canvas.width, canvas.height]
    });
    
    pdf.addImage(dataURL, 'PNG', 0, 0, canvas.width, canvas.height);
    
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
      
      setTimeout(() => {
        URL.revokeObjectURL(blobURL);
      }, 5000);
      
      toast.success('🖨️ Print dialog opened!');
    } else {
      // Fallback: download if popup blocked
      const link = document.createElement('a');
      link.href = blobURL;
      link.download = `${design.name || 'design'}-print.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(blobURL);
      toast.success('📥 PDF downloaded!');
    }
    
    console.log('🎉 Simple print completed!');
    
  } catch (error) {
    console.error('❌ Simple print failed:', error);
    toast.error(`Print failed: ${error.message}`);
    throw error;
  }
};
