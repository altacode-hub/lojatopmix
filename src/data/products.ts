export type Product = {
  id: string
  code: string
  name: string
  price: number
  images: string[]
  colors: string[]
}

export const products: Product[] = [
  {
    id: 'p1',
    code: '209',
    name: 'Vestido viscolinho estampado',
    price: 47,
    images: [
      'https://picsum.photos/id/1011/900/1200',
      'https://picsum.photos/id/1012/900/1200',
      'https://picsum.photos/id/1013/900/1200',
      'https://picsum.photos/id/1014/900/1200',
    ],
    colors: ['Verde', 'Preto', 'Bege', 'Marrom', 'Azul'],
  },
  {
    id: 'p2',
    code: '441',
    name: 'Vestido duna estampado',
    price: 47,
    images: [
      'https://picsum.photos/id/1021/900/1200',
      'https://picsum.photos/id/1022/900/1200',
      'https://picsum.photos/id/1023/900/1200',
      'https://picsum.photos/id/1024/900/1200',
    ],
    colors: ['Verde', 'Vinho', 'Azul', 'Terracota'],
  },
  {
    id: 'p3',
    code: '464',
    name: 'Vestido duna estampado',
    price: 47,
    images: [
      'https://picsum.photos/id/1031/900/1200',
      'https://picsum.photos/id/1032/900/1200',
      'https://picsum.photos/id/1033/900/1200',
    ],
    colors: ['Azul', 'Verde', 'Preto'],
  },
  {
    id: 'p4',
    code: '534',
    name: 'Vestido duna estampado',
    price: 47,
    images: [
      'https://picsum.photos/id/1041/900/1200',
      'https://picsum.photos/id/1042/900/1200',
    ],
    colors: ['Verde', 'Marrom', 'Azul'],
  },
  {
    id: 'p5',
    code: '209B',
    name: 'Vestido viscolinho liso',
    price: 47,
    images: [
      'https://picsum.photos/id/1051/900/1200',
      'https://picsum.photos/id/1052/900/1200',
    ],
    colors: ['Preto', 'Vinho', 'Bege'],
  },
  {
    id: 'p6',
    code: '300',
    name: 'Vestido floral midi',
    price: 47,
    images: [
      'https://picsum.photos/id/1061/900/1200',
      'https://picsum.photos/id/1062/900/1200',
    ],
    colors: ['Verde', 'Azul', 'Terracota'],
  },
]
