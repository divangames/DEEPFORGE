import type { MineId, MineOrdinal, SectorId } from './types';

export interface MineTuning {
  resourcePrice: number;
  yieldMultiplier: number;
  durationMultiplier: number;
  liftCapacityMultiplier: number;
  hubCapacityMultiplier: number;
}

export interface WorldMineDefinition {
  id: MineId;
  sectorId: SectorId;
  code: string;
  name: string;
  resourceName: string;
  description: string;
  unlockEarnedRequired: number;
  previousMineId: MineId | null;
  mapX: number;
  mapY: number;
  theme: {
    mine: number;
    surface: number;
    accent: string;
    accentSoft: string;
  };
  tuning: MineTuning;
}

export interface WorldSectorDefinition {
  id: SectorId;
  code: string;
  name: string;
  currencyCode: string;
  currencyName: string;
  description: string;
  unlockEarnedRequired: number;
  previousSectorId: SectorId | null;
  mapX: number;
  mapY: number;
  accent: string;
  accentSoft: string;
  mines: readonly WorldMineDefinition[];
}

export const DEFAULT_MINE_TUNING: MineTuning = {
  resourcePrice: 2,
  yieldMultiplier: 1,
  durationMultiplier: 1,
  liftCapacityMultiplier: 1,
  hubCapacityMultiplier: 1,
};

const MINE_ORDINALS: readonly MineOrdinal[] = ['01', '02', '03', '04', '05'];
const SITE_UNLOCKS = [0, 750, 18_000, 420_000, 8_500_000] as const;
const SITE_POINTS = [
  [17, 73],
  [34, 51],
  [53, 64],
  [69, 38],
  [84, 20],
] as const;
const SITE_PRICE = [1, 1.625, 2.75, 4.75, 8.5] as const;
const SITE_YIELD = [1, 1.08, 1.18, 1.32, 1.48] as const;
const SITE_DURATION = [1, 1.05, 1.08, 1.12, 1.15] as const;
const SITE_LIFT = [1, 1.02, 1.05, 0.98, 1.04] as const;
const SITE_HUB = [1, 1.02, 1.05, 0.95, 1.02] as const;

interface SectorBuildInput {
  id: SectorId;
  code: string;
  name: string;
  currencyCode: string;
  currencyName: string;
  description: string;
  unlockEarnedRequired: number;
  previousSectorId: SectorId | null;
  mapX: number;
  mapY: number;
  accent: string;
  accentSoft: string;
  mineColor: number;
  surfaceColor: number;
  economyScale: number;
  names: readonly [string, string, string, string, string];
  resources: readonly [string, string, string, string, string];
  descriptions: readonly [string, string, string, string, string];
}

function buildSector(input: SectorBuildInput): WorldSectorDefinition {
  const mines = MINE_ORDINALS.map((ordinal, index): WorldMineDefinition => {
    const id = `${input.id}-${ordinal}` as MineId;
    const previousMineId = index === 0 ? null : `${input.id}-${MINE_ORDINALS[index - 1]}` as MineId;
    return {
      id,
      sectorId: input.id,
      code: `${input.code}-${ordinal}`,
      name: input.names[index],
      resourceName: input.resources[index],
      description: input.descriptions[index],
      unlockEarnedRequired: SITE_UNLOCKS[index],
      previousMineId,
      mapX: SITE_POINTS[index][0],
      mapY: SITE_POINTS[index][1],
      theme: {
        mine: input.mineColor,
        surface: input.surfaceColor,
        accent: input.accent,
        accentSoft: input.accentSoft,
      },
      tuning: {
        resourcePrice: 2 * input.economyScale * SITE_PRICE[index],
        yieldMultiplier: input.economyScale * SITE_YIELD[index],
        durationMultiplier: SITE_DURATION[index],
        liftCapacityMultiplier: SITE_LIFT[index],
        hubCapacityMultiplier: SITE_HUB[index],
      },
    };
  });

  return { ...input, mines };
}

export const WORLD_SECTORS: readonly WorldSectorDefinition[] = [
  buildSector({
    id: 'rust', code: 'RV', name: 'Rust Valley', currencyCode: 'RC', currencyName: 'Rust Credits',
    description: 'Промышленная пустошь, с которой начинается добывающая империя.',
    unlockEarnedRequired: 0, previousSectorId: null, mapX: 13, mapY: 68,
    accent: '#f0b429', accentSoft: '#5d481d', mineColor: 0x171b20, surfaceColor: 0x29333a, economyScale: 1,
    names: ['Scrapline Quarry', 'Cinder Cut', 'Iron Mesa', 'Redline Chasm', 'Forge Crater'],
    resources: ['Ferrite Ore', 'Copper Shale', 'Cobalt Ore', 'Tungsten Rock', 'Iridium Matrix'],
    descriptions: [
      'Старая промышленная выработка на краю Ржавой долины.',
      'Горячая трещина с более дорогой рудой и тяжёлыми пластами.',
      'Высокая сухая платформа с плотными металлическими жилами.',
      'Глубокий каньон, где логистика важнее сырой скорости добычи.',
      'Финальный объект сектора: дорогая руда и агрессивный рост экономики.',
    ],
  }),
  buildSector({
    id: 'glacier', code: 'GB', name: 'Glacier Belt', currencyCode: 'CC', currencyName: 'Cryo Credits',
    description: 'Ледяной пояс с замёрзшими залежами и тяжёлой холодной логистикой.',
    unlockEarnedRequired: 8_500_000, previousSectorId: 'rust', mapX: 28, mapY: 38,
    accent: '#69c7ff', accentSoft: '#1e526d', mineColor: 0x111b23, surfaceColor: 0x254352, economyScale: 1.08,
    names: ['Frostbite Pit', 'Whiteout Shaft', 'Blue Ice Trench', 'Permafrost Core', 'Cryo Crown'],
    resources: ['Cryolite', 'Frozen Nickel', 'Azurite Ice', 'Palladium Frost', 'Cryo Crystal'],
    descriptions: [
      'Первый карьер в зоне вечной мерзлоты.',
      'Белая буря постоянно заметает транспортные пути.',
      'Синий лед скрывает редкие металлические включения.',
      'Глубокая мерзлота давит на оборудование и людей.',
      'Самый богатый ледяной объект пояса.',
    ],
  }),
  buildSector({
    id: 'ember', code: 'EF', name: 'Ember Fault', currencyCode: 'ES', currencyName: 'Ember Scrip',
    description: 'Вулканический разлом, где производство работает на грани перегрева.',
    unlockEarnedRequired: 14_000_000, previousSectorId: 'glacier', mapX: 46, mapY: 58,
    accent: '#ff7048', accentSoft: '#6d2d20', mineColor: 0x221512, surfaceColor: 0x4a2b22, economyScale: 1.16,
    names: ['Ashmouth Dig', 'Magma Vein', 'Cinder Rift', 'Obsidian Gate', 'Inferno Core'],
    resources: ['Basalt Ore', 'Magma Copper', 'Volcanic Glass', 'Obsidian Alloy', 'Pyrite Core'],
    descriptions: [
      'Пепельный вход в главный вулканический разлом.',
      'Жила проходит рядом с открытыми потоками магмы.',
      'Нестабильная трещина с высокой ценностью сырья.',
      'Обсидиановый слой требует мощной логистики.',
      'Сердце разлома и самый прибыльный объект сектора.',
    ],
  }),
  buildSector({
    id: 'aurora', code: 'AS', name: 'Aurora Steppe', currencyCode: 'AM', currencyName: 'Aurora Marks',
    description: 'Высокогорная степь под сиянием энергетических бурь.',
    unlockEarnedRequired: 22_000_000, previousSectorId: 'ember', mapX: 61, mapY: 28,
    accent: '#7cf2c4', accentSoft: '#245c4d', mineColor: 0x12201c, surfaceColor: 0x294a40, economyScale: 1.24,
    names: ['Windscar Field', 'Lumen Trench', 'Skyglass Cut', 'Aurora Vault', 'Zenith Quarry'],
    resources: ['Vanadium Dust', 'Lumen Ore', 'Skyglass', 'Neonite', 'Aurorium'],
    descriptions: [
      'Ветреная степь с неглубокими металлическими пластами.',
      'Светящаяся траншея вдоль энергетического разлома.',
      'Хрупкая порода, похожая на стекло.',
      'Скрытая под плато камера с редкой рудой.',
      'Высшая точка степи и главный добывающий узел.',
    ],
  }),
  buildSector({
    id: 'twilight', code: 'TB', name: 'Twilight Basin', currencyCode: 'DT', currencyName: 'Dusk Tokens',
    description: 'Тёмная котловина с минералами, реагирующими на слабый свет.',
    unlockEarnedRequired: 35_000_000, previousSectorId: 'aurora', mapX: 74, mapY: 52,
    accent: '#a884ff', accentSoft: '#46356d', mineColor: 0x191525, surfaceColor: 0x362f4f, economyScale: 1.34,
    names: ['Dusk Quarry', 'Shadow Run', 'Violet Sink', 'Nightglass Pit', 'Eclipse Core'],
    resources: ['Duskstone', 'Shadow Iron', 'Violet Quartz', 'Nightglass', 'Eclipse Ore'],
    descriptions: [
      'Вход в сумеречную котловину.',
      'Длинный проход между почти чёрными пластами.',
      'Фиолетовая воронка с высокой концентрацией минералов.',
      'Залежи тёмного стекла и редких металлов.',
      'Центральный объект котловины, работающий без остановки.',
    ],
  }),
  buildSector({
    id: 'relic', code: 'RW', name: 'Relic Wastes', currencyCode: 'RB', currencyName: 'Relic Bonds',
    description: 'Пустошь древних сооружений и техногенных залежей неизвестного происхождения.',
    unlockEarnedRequired: 55_000_000, previousSectorId: 'twilight', mapX: 87, mapY: 24,
    accent: '#e8c675', accentSoft: '#67562f', mineColor: 0x201d16, surfaceColor: 0x474131, economyScale: 1.46,
    names: ['Broken Spire', 'Fossil Yard', 'Ancient Cut', 'Vault Scar', 'Relic Nexus'],
    resources: ['Relic Iron', 'Fossil Alloy', 'Ancient Bronze', 'Vault Metal', 'Nexus Shard'],
    descriptions: [
      'Разрушенная башня поверх богатой жилы.',
      'Карьер среди окаменевших конструкций.',
      'Старый разрез неизвестной цивилизации.',
      'Повреждённое хранилище с необычным металлом.',
      'Центр древнего комплекса и финальная точка пустоши.',
    ],
  }),
  buildSector({
    id: 'sunken', code: 'SS', name: 'Sunken Shelf', currencyCode: 'AC', currencyName: 'Abyss Credits',
    description: 'Затопленный шельф, где добыча идёт под экстремальным давлением.',
    unlockEarnedRequired: 85_000_000, previousSectorId: 'relic', mapX: 64, mapY: 82,
    accent: '#42d7d7', accentSoft: '#1d5d61', mineColor: 0x0d1d22, surfaceColor: 0x173c46, economyScale: 1.60,
    names: ['Tidal Shaft', 'Coral Rupture', 'Abyss Line', 'Pressure Vault', 'Leviathan Trench'],
    resources: ['Seafloor Iron', 'Coral Copper', 'Abyssite', 'Pressure Pearl', 'Leviathan Ore'],
    descriptions: [
      'Первый подводный объект на краю шельфа.',
      'Разлом среди минеральных кораллов.',
      'Длинная глубоководная линия добычи.',
      'Закрытая камера под огромным давлением.',
      'Самая глубокая и богатая траншея сектора.',
    ],
  }),
  buildSector({
    id: 'storm', code: 'SC', name: 'Storm Cradle', currencyCode: 'SM', currencyName: 'Storm Marks',
    description: 'Финальный регион текущей карты — гигантский штормовой массив с заряженной рудой.',
    unlockEarnedRequired: 130_000_000, previousSectorId: 'sunken', mapX: 39, mapY: 86,
    accent: '#d7edff', accentSoft: '#405c72', mineColor: 0x111921, surfaceColor: 0x293c4c, economyScale: 1.78,
    names: ['Static Ridge', 'Thunder Mine', 'Ion Gorge', 'Tempest Well', 'Stormheart'],
    resources: ['Static Ore', 'Thunderium', 'Ion Crystal', 'Tempest Alloy', 'Stormheart Core'],
    descriptions: [
      'Гребень, постоянно заряженный статическим электричеством.',
      'Шахта прямо под линией грозового фронта.',
      'Ионизированный каньон с опасными залежами.',
      'Вертикальный штормовой колодец.',
      'Главный объект региона и вершина текущей мировой прогрессии.',
    ],
  }),
] as const;

export const WORLD_MINES: readonly WorldMineDefinition[] = WORLD_SECTORS.flatMap((sector) => sector.mines);
export const RUST_VALLEY_MINES = WORLD_SECTORS[0].mines;
export const DEFAULT_SECTOR_ID: SectorId = 'rust';
export const DEFAULT_MINE_ID: MineId = 'rust-01';

export function getSectorDefinition(id: SectorId): WorldSectorDefinition {
  return WORLD_SECTORS.find((sector) => sector.id === id) ?? WORLD_SECTORS[0];
}

export function getSectorIndex(id: SectorId): number {
  return Math.max(0, WORLD_SECTORS.findIndex((sector) => sector.id === id));
}

export function getMineDefinition(id: MineId): WorldMineDefinition {
  return WORLD_MINES.find((mine) => mine.id === id) ?? WORLD_SECTORS[0].mines[0];
}

export function getMineIndex(id: MineId): number {
  const sector = getSectorDefinition(getMineDefinition(id).sectorId);
  return Math.max(0, sector.mines.findIndex((mine) => mine.id === id));
}

export function getFirstMineId(sectorId: SectorId): MineId {
  return getSectorDefinition(sectorId).mines[0].id;
}
