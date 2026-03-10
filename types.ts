
export interface Product {
  id: string;
  name: string;
  imageUrl: string;
  description: string;
}

export interface TryOnState {
  userImage: string | null;
  selectedProduct: Product | null;
  resultImage: string | null;
  recommendedSize: string | null;
  isLoading: boolean;
  error: string | null;
}
