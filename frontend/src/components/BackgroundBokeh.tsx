import React, { useState } from 'react';

export interface BackgroundArtOption {
  id: string;
  name: string;
  artistStyle: string;
  category: string;
  artUrl: string;
  accentColor: string;
  brushType: 'oil' | 'gouache' | 'watercolor' | 'impressionist';
  description: string;
}

export const BACKGROUND_ART_PRESETS: BackgroundArtOption[] = [
  {
    id: 'ghibli-valley-oil',
    name: 'Ghibli Mountain Valley',
    artistStyle: 'Studio Ghibli Matte Painting',
    category: 'Anime Background Art',
    // High-resolution oil / digital matte painting with rolling green hills, pine ridges and painterly clouds
    artUrl: 'https://images.unsplash.com/photo-1579783902614-a3fb3927b675?q=80&w=2560&auto=format&fit=crop',
    accentColor: '#10B981',
    brushType: 'oil',
    description: 'Lush rolling green slopes and pine forest with oil brush textures and warm morning sky',
  },
  {
    id: 'impressionist-meadow',
    name: 'Impressionist Alpine Hills',
    artistStyle: 'Claude Monet & Cézanne',
    category: 'Impressionist Oil on Canvas',
    artUrl: 'https://images.unsplash.com/photo-1578301978693-85fa9c0320b9?q=80&w=2560&auto=format&fit=crop',
    accentColor: '#3B82F6',
    brushType: 'impressionist',
    description: 'Thick impasto palette knife strokes, vibrant emerald pastures and misty blue peaks',
  },
  {
    id: 'watercolor-mountains',
    name: 'Misty Highland Watercolor',
    artistStyle: 'Japanese Nihonga & Sumi-e',
    category: 'Watercolor on Rice Paper',
    artUrl: 'https://images.unsplash.com/photo-1541701494587-cb58502866ab?q=80&w=2560&auto=format&fit=crop',
    accentColor: '#06B6D4',
    brushType: 'watercolor',
    description: 'Soft translucent watercolor washes, layered pine ridges in morning mountain fog',
  },
  {
    id: 'gouache-golden-peaks',
    name: 'Golden Hour Gouache',
    artistStyle: 'Eyvind Earle & Makoto Shinkai',
    category: 'Gouache Painting',
    artUrl: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?q=80&w=2560&auto=format&fit=crop',
    accentColor: '#F59E0B',
    brushType: 'gouache',
    description: 'Warm pastel clouds with golden rims, serene mountain valleys and painterly light rays',
  },
  {
    id: 'classic-scenery-oil',
    name: 'Alpine Pine Ridge Oil',
    artistStyle: 'Albert Bierstadt Romanticism',
    category: 'Classic Landscape Painting',
    artUrl: 'https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?q=80&w=2560&auto=format&fit=crop',
    accentColor: '#059669',
    brushType: 'oil',
    description: 'Majestic painted pine ridges with rich green undertones and dramatic brush strokes',
  },
];

interface BackgroundScenicProps {
  selectedId: string;
  canvasTextureLevel?: 'subtle' | 'medium' | 'high';
}

export const BackgroundBokeh: React.FC<BackgroundScenicProps> = ({ 
  selectedId,
  canvasTextureLevel = 'medium' 
}) => {
  const current = BACKGROUND_ART_PRESETS.find((b) => b.id === selectedId) || BACKGROUND_ART_PRESETS[0];

  return (
    <div 
      aria-hidden="true" 
      className="fixed inset-0 pointer-events-none overflow-hidden z-0 bg-[#F4F6F4]"
    >
      {/* 1. Base Painted Landscape Artwork Layer */}
      <div 
        className="absolute inset-0 w-full h-full bg-cover bg-center bg-no-repeat transition-all duration-700 scale-[1.02]"
        style={{
          backgroundImage: `url(${current.artUrl})`,
          filter: 'contrast(1.05) saturate(1.15) brightness(1.02)',
        }}
      />

      {/* 2. Oil Impasto & Palette Knife Texture Displacement Simulation */}
      <div 
        className="absolute inset-0 opacity-40 mix-blend-overlay pointer-events-none"
        style={{
          backgroundImage: `radial-gradient(ellipse at 30% 70%, rgba(255,255,255,0.4) 0%, transparent 50%),
                            radial-gradient(ellipse at 80% 40%, rgba(240,250,230,0.5) 0%, transparent 60%)`,
        }}
      />

      {/* 3. Painterly Brush Stroke & Canvas Weave Texture Layer */}
      <div 
        className="absolute inset-0 pointer-events-none mix-blend-multiply opacity-[0.14]"
        style={{
          backgroundImage: `radial-gradient(circle at 50% 50%, rgba(0,0,0,0.1) 1px, transparent 1px),
                            linear-gradient(45deg, rgba(0,0,0,0.04) 25%, transparent 25%, transparent 75%, rgba(0,0,0,0.04) 75%, rgba(0,0,0,0.04)),
                            linear-gradient(45deg, rgba(0,0,0,0.04) 25%, transparent 25%, transparent 75%, rgba(0,0,0,0.04) 75%, rgba(0,0,0,0.04))`,
          backgroundSize: '16px 16px, 8px 8px, 8px 8px',
          backgroundPosition: '0 0, 0 0, 4px 4px',
        }}
      />

      {/* 4. Fine Art Paper & Linen Grain Filter */}
      <div 
        className="absolute inset-0 pointer-events-none opacity-[0.08] mix-blend-overlay"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='canvasGrain'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3CfeColorMatrix type='matrix' values='1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 19 -9'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23canvasGrain)'/%3E%3C/svg%3E")`,
        }}
      />

      {/* 5. Translucent Atmospheric Mist & Frosted Varnish (Keeps UI card, token buttons & text ultra-sharp & readable) */}
      <div 
        className="absolute inset-0 transition-all duration-700"
        style={{
          background: 'linear-gradient(to bottom, rgba(255, 255, 255, 0.94) 0%, rgba(255, 255, 255, 0.78) 35%, rgba(255, 255, 255, 0.42) 75%, rgba(255, 255, 255, 0.18) 100%)',
        }}
      />

      {/* 6. Soft Warm Light Vignette along edges */}
      <div 
        className="absolute inset-0 pointer-events-none opacity-25"
        style={{
          background: 'radial-gradient(ellipse at 50% 30%, transparent 40%, rgba(30, 40, 25, 0.08) 100%)',
        }}
      />
    </div>
  );
};
