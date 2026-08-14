import { Product } from '../lib/types'

interface Props {
  status: Product['stock_status']
  showLabel?: boolean
}

export default function StockBadge({ status, showLabel = true }: Props) {
  const config = {
    in_stock: { color: 'bg-green-500/20 text-green-400', label: 'In Stock' },
    low_stock: { color: 'bg-yellow-500/20 text-yellow-400', label: 'Low Stock' },
    out_of_stock: { color: 'bg-red-500/20 text-red-400', label: 'Out of Stock' },
    discontinued: { color: 'bg-gray-500/20 text-gray-400', label: 'Discontinued' },
  }

  const { color, label } = config[status]

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${color}`}
    >
      <span
        className={`w-1.5 h-1.5 rounded-full ${
          status === 'in_stock'
            ? 'bg-green-400'
            : status === 'low_stock'
            ? 'bg-yellow-400'
            : status === 'out_of_stock'
            ? 'bg-red-400'
            : 'bg-gray-400'
        }`}
      ></span>
      {showLabel && label}
    </span>
  )
}
