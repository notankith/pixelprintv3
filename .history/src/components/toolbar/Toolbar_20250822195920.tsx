import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Type, Image, Calendar, Plus } from 'lucide-react';
import { useState } from 'react';
import { DesignElement } from '../StickerDesigner';
import { toast } from 'sonner';

interface ToolbarProps {
  onElementAdd: (element: DesignElement) => void;
}

export const Toolbar = ({ onElementAdd }: ToolbarProps) => {
  const [imageUrl, setImageUrl] = useState('');

  const addTextElement = () => {
    const element: DesignElement = {
      id: `text-${Date.now()}`,
      type: 'text',
      x: 100,
      y: 100,
      width: 200,
      height: 30,
      rotation: 0,
      zIndex: 1,
      properties: {
        text: 'Your Text Here',
        fontSize: 16,
        fontFamily: 'Arial',
        color: '#000000',
        bold: false,
        italic: false,
        alignment: 'left'
      }
    };
    onElementAdd(element);
    toast.success('Text element added');
  };

  const addImageElement = () => {
    if (!imageUrl.trim()) {
      toast.error('Please enter an image URL');
      return;
    }

    // Validate URL format
    const url = imageUrl.trim();
    try {
      new URL(url);
    } catch {
      toast.error('Please enter a valid URL');
      return;
    }

    // Check if URL is likely an image
    const imageExtensions = /\.(jpg|jpeg|png|gif|bmp|webp|svg)(\?.*)?$/i;
    const isImageUrl = imageExtensions.test(url) || 
                      url.includes('unsplash.com') || 
                      url.includes('imgur.com') ||
                      url.includes('pixabay.com') ||
                      url.includes('pexels.com') ||
                      url.startsWith('data:image/');

    if (!isImageUrl) {
      toast('Warning: URL may not be an image. Adding anyway...', { duration: 3000 });
    }

    const element: DesignElement = {
      id: `image-${Date.now()}`,
      type: 'image',
      x: 100,
      y: 100,
      width: 200,
      height: 200,
      rotation: 0,
      zIndex: 1,
      properties: {
        url: url
      }
    };
    
    onElementAdd(element);
    setImageUrl('');
    toast.success('Image element added - loading...');
  };

  const addDateElement = () => {
    const element: DesignElement = {
      id: `date-${Date.now()}`,
      type: 'date',
      x: 100,
      y: 100,
      width: 150,
      height: 30,
      rotation: 0,
      zIndex: 1,
      properties: {
        format: 'DD/MM/YYYY',
        fontSize: 16,
        fontFamily: 'Arial',
        color: '#000000'
      }
    };
    onElementAdd(element);
    toast.success('Date element added');
  };

  return (
    <div className="flex items-center gap-4 flex-wrap">
      {/* Add Text */}
      <Button 
        onClick={addTextElement}
        variant="outline" 
        size="sm"
        className="flex items-center gap-2"
      >
        <Type className="w-4 h-4" />
        Add Text
      </Button>

      {/* Add Image */}
      <div className="flex items-center gap-2">
        <Input
          placeholder="Enter image URL (e.g., https://picsum.photos/300/200)"
          value={imageUrl}
          onChange={(e) => setImageUrl(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addImageElement()}
          className="w-64 h-8"
        />
        <Button 
          onClick={addImageElement}
          variant="outline" 
          size="sm"
          className="flex items-center gap-2"
          disabled={!imageUrl.trim()}
        >
          <Plus className="w-4 h-4" />
          <Image className="w-4 h-4" />
          Add
        </Button>
      </div>

      {/* Quick Image Examples */}
      <div className="flex items-center gap-1">
        <span className="text-xs text-muted-foreground">Quick:</span>
        <Button
          onClick={() => setImageUrl('https://picsum.photos/300/200')}
          variant="ghost"
          size="sm"
          className="h-6 px-2 text-xs"
        >
          Random
        </Button>
        <Button
          onClick={() => setImageUrl('https://via.placeholder.com/300x200/4F46E5/white?text=Sample')}
          variant="ghost"
          size="sm"
          className="h-6 px-2 text-xs"
        >
          Placeholder
        </Button>
      </div>

      {/* Add Date */}
      <Button 
        onClick={addDateElement}
        variant="outline" 
        size="sm"
        className="flex items-center gap-2"
      >
        <Calendar className="w-4 h-4" />
        Add Date
      </Button>
    </div>
  );
};