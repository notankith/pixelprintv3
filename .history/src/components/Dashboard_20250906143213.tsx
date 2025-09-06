import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Edit, Trash2, Printer, Plus, ExternalLink, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Design, DesignElement } from './StickerDesigner';
import { generateCanvasThumbnail, printDesign } from '@/utils/canvasUtils';
import { simplePrintDesign } from '@/utils/simplePrint';

interface DashboardProps {
  onNavigateToEditor: (design?: Design) => void;
}

interface SavedDesign extends Design {
  thumbnail?: string;
  created_at?: string;
  updated_at?: string;
}

export const Dashboard: React.FC<DashboardProps> = ({ onNavigateToEditor }) => {
  const [designs, setDesigns] = useState<SavedDesign[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [generatingThumbnails, setGeneratingThumbnails] = useState<Set<string>>(new Set());

  // Load designs on component mount
  useEffect(() => {
    loadDesigns();
  }, []);

  const loadDesigns = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('designs')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const formattedDesigns: SavedDesign[] = data.map(d => ({
        id: d.id,
        name: d.name,
        canvasWidth: d.canvas_width,
        canvasHeight: d.canvas_height,
        elements: Array.isArray(d.elements) ? (d.elements as unknown as DesignElement[]) : [],
        thumbnail: d.thumbnail_url,
        created_at: d.created_at,
        updated_at: d.updated_at,
      }));

      setDesigns(formattedDesigns);
    } catch (error) {
      console.error('Error loading designs:', error);
      toast.error('Failed to load designs');
    } finally {
      setIsLoading(false);
    }
  };

  const handleEdit = (design: SavedDesign) => {
    onNavigateToEditor(design);
  };

  const handleDelete = async (designId: string, designName: string) => {
    if (!window.confirm(`Are you sure you want to delete "${designName}"?`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('designs')
        .delete()
        .eq('id', designId);

      if (error) throw error;

      setDesigns(prev => prev.filter(d => d.id !== designId));
      toast.success('Design deleted successfully');
    } catch (error) {
      console.error('Error deleting design:', error);
      toast.error('Failed to delete design');
    }
  };

  const handleQuickPrint = async (design: SavedDesign) => {
    try {
      console.log('🖨️ Quick Print requested for design:', design.id);
      console.log('📋 Design data:', {
        name: design.name,
        canvasWidth: design.canvasWidth,
        canvasHeight: design.canvasHeight,
        elementsCount: design.elements?.length || 0
      });
      
      // Use the simple print function for testing
      await simplePrintDesign(design);
      console.log('✅ Print completed successfully');
      
    } catch (error) {
      console.error('❌ Error with Quick Print:', error);
      toast.error(error.message || 'Failed to print. Please try again.');
    }
  };

  const generateNewThumbnail = async (design: SavedDesign) => {
    if (generatingThumbnails.has(design.id)) return;
    
    setGeneratingThumbnails(prev => new Set(prev).add(design.id));
    
    try {
      const thumbnailDataURL = await generateCanvasThumbnail(design);
      
      // Update the design with the generated thumbnail
      setDesigns(prev => prev.map(d => 
        d.id === design.id ? { ...d, thumbnail: thumbnailDataURL } : d
      ));
      
      // Optionally save thumbnail to database
      await supabase
        .from('designs')
        .update({ thumbnail_url: thumbnailDataURL })
        .eq('id', design.id);
        
    } catch (error) {
      console.error('Error generating thumbnail:', error);
    } finally {
      setGeneratingThumbnails(prev => {
        const next = new Set(prev);
        next.delete(design.id);
        return next;
      });
    }
  };

  const renderThumbnail = (design: SavedDesign) => {
    const isGenerating = generatingThumbnails.has(design.id);
    
    // Always use the saved thumbnail_url if available
    if (design.thumbnail) {
      return (
        <div className="relative">
          <div className="w-full h-40 bg-pastel-pink rounded-md border-2 border-pastel-purple overflow-hidden">
            <img 
              src={design.thumbnail} 
              alt={design.name}
              className="w-full h-full object-contain"
              style={{ 
                imageRendering: 'crisp-edges'
              }}
            />
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => generateNewThumbnail(design)}
            className="absolute top-1 right-1 h-6 w-6 p-0 bg-pastel-yellow hover:bg-pastel-blue border border-pastel-purple"
            disabled={isGenerating}
          >
            <RefreshCw className={`h-3 w-3 ${isGenerating ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      );
    }
    
    // Create a simple thumbnail representation
    const elementCount = design.elements.length;
    const hasText = design.elements.some(e => e.type === 'text');
    const hasImage = design.elements.some(e => e.type === 'image');
    
    return (
      <div className="relative w-full h-40 bg-gray-100 border-2 border-dashed border-gray-300 rounded-md flex flex-col items-center justify-center text-gray-500 text-sm">
        <div className="font-medium">{design.canvasWidth} × {design.canvasHeight}</div>
        <div className="mt-1">
          {elementCount} element{elementCount !== 1 ? 's' : ''}
        </div>
        <div className="flex gap-1 mt-1">
          {hasText && <Badge variant="secondary" className="text-xs">Text</Badge>}
          {hasImage && <Badge variant="secondary" className="text-xs">Image</Badge>}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => generateNewThumbnail(design)}
          className="mt-2 h-6 text-xs"
          disabled={isGenerating}
        >
          {isGenerating ? (
            <>
              <RefreshCw className="h-3 w-3 animate-spin mr-1" />
              Generating...
            </>
          ) : (
            'Generate Preview'
          )}
        </Button>
      </div>
    );
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Unknown';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <div className="min-h-screen flex flex-col bg-beige">
      {/* Header */}
      <div className="bg-pastel-yellow shadow-sm border-b border-pastel-purple">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-3xl font-bold text-pastel-purple">PixelPrint</h1>
            </div>
            <Button 
              onClick={() => onNavigateToEditor()}
              className="mt-4 sm:mt-0 bg-pastel-green hover:bg-pastel-blue text-pastel-purple border-2 border-pastel-purple"
              size="lg"
            >
              <Plus className="h-4 w-4 mr-2" />
              New Design
            </Button>
          </div>
        </div>
      </div>
      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1 bg-beige">
        <div className="mb-6">
          <h2 className="text-xl font-semibold text-pastel-purple mb-2">Your Designs</h2>
          <Separator className="bg-pastel-blue" />
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {[...Array(8)].map((_, i) => (
              <Card key={i} className="animate-pulse">
                <CardContent className="p-4">
                  <div className="w-full h-32 bg-gray-200 rounded-md mb-4"></div>
                  <div className="h-4 bg-gray-200 rounded mb-2"></div>
                  <div className="h-3 bg-gray-200 rounded w-2/3 mb-4"></div>
                  <div className="flex gap-2">
                    <div className="h-8 bg-gray-200 rounded flex-1"></div>
                    <div className="h-8 bg-gray-200 rounded w-8"></div>
                    <div className="h-8 bg-gray-200 rounded w-8"></div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : designs.length === 0 ? (
          <div className="text-center py-12">
            <div className="max-w-md mx-auto">
              <div className="mb-4 text-gray-400">
                <svg className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No designs yet</h3>
              <p className="text-gray-500 mb-6">Start creating your first design to see it here.</p>
              <Button onClick={() => onNavigateToEditor()} size="lg">
                <Plus className="h-4 w-4 mr-2" />
                Create Your First Design
              </Button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {designs.map((design) => (
              <Card key={design.id} className="hover:shadow-lg transition-shadow duration-200 border-2 border-pastel-purple bg-pastel-yellow">
                <CardHeader className="pb-3 bg-pastel-blue rounded-t-md">
                  <div className="aspect-video">
                    {renderThumbnail(design)}
                  </div>
                </CardHeader>
                <CardContent className="pt-0 bg-pastel-yellow rounded-b-md">
                  <div className="mb-3">
                    <h3 className="font-medium text-pastel-purple truncate" title={design.name}>
                      {design.name}
                    </h3>
                    <p className="text-sm text-pastel-green mt-1">
                      Modified {formatDate(design.updated_at)}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => handleEdit(design)}
                      className="flex-1 bg-pastel-green hover:bg-pastel-blue text-pastel-purple border-2 border-pastel-purple"
                    >
                      <Edit className="h-3 w-3 mr-1" />
                      Edit
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDelete(design.id, design.name)}
                      className="px-2 hover:bg-pastel-pink hover:border-pastel-purple border-2 border-pastel-purple bg-pastel-pink"
                    >
                      <Trash2 className="h-3 w-3 text-pastel-purple" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
      {/* Footer separator and credits at the extreme bottom */}
      <div className="w-full h-2 bg-pastel-purple opacity-40 mt-8" />
      <footer className="w-full bg-pastel-blue text-center py-4 mt-0 border-t-2 border-pastel-purple">
        <a href="https://ankith.studio" target="_blank" rel="noopener noreferrer" className="text-pastel-purple font-medium hover:underline">
          ankith.studio
        </a>
      </footer>
    </div>
  );
};
