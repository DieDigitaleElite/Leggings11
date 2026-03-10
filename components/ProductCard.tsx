
import React from 'react';
import { Product } from '../types';

interface ProductCardProps {
  product: Product;
  isSelected: boolean;
  onSelect: (product: Product) => void;
}

const ProductCard: React.FC<ProductCardProps> = ({ product, isSelected, onSelect }) => {
  return (
    <div 
      onClick={() => onSelect(product)}
      className={`relative cursor-pointer transition-all duration-300 rounded-2xl md:rounded-3xl overflow-hidden ${
        isSelected ? 'ring-2 md:ring-4 ring-indigo-600 ring-offset-1 md:ring-offset-2 scale-102 md:scale-105 shadow-2xl z-10' : 'hover:scale-102 shadow-md'
      }`}
    >
      <div className="aspect-[3/4] overflow-hidden bg-slate-100">
        <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover" />
      </div>
      <div className="absolute inset-x-0 bottom-0 p-3 md:p-4 bg-gradient-to-t from-black/80 to-transparent text-white">
        <h3 className="font-bold text-[10px] md:text-sm uppercase italic tracking-tighter truncate">{product.name}</h3>
      </div>
    </div>
  );
};

export default ProductCard;
