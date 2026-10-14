export interface ProcessedPhoto {
  cutoutUri: string;
  width: number;
  height: number;
  dominantColor: string;
  labels: string[];
}

export type ModelStatus = 'ready' | 'downloading';
