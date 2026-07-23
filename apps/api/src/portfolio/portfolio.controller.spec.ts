import { Test, TestingModule } from '@nestjs/testing';
import { PortfolioController } from './portfolio.controller';
import { PortfolioService } from './portfolio.service';

describe('PortfolioController', () => {
  let controller: PortfolioController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PortfolioController],
      providers: [PortfolioService],
    }).compile();

    controller = module.get<PortfolioController>(PortfolioController);
  });

  it('returns the full portfolio data', () => {
    const result = controller.getPortfolio();

    expect(result).toHaveProperty('projetos');
    expect(result).toHaveProperty('Experiencia_Profissional');
    expect(result).toHaveProperty('CERTIFICACAO');
    expect(result).toHaveProperty('CURSOS');
    expect(result).toHaveProperty('DADOS_PESSOAIS');
  });
});
