import { Injectable } from '@nestjs/common';
import dados from '../data/dados.json';

@Injectable()
export class PortfolioService {
  getAll() {
    return dados;
  }
}
