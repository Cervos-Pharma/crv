export default function Logistics() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-display font-bold text-white">Logistics</h2>
        <p className="text-gray-400 mt-1">Track your shipments and deliveries</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-surface-100 rounded-xl border border-surface-300 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-yellow-500/20 rounded-lg">
              <span className="material-symbols-outlined text-yellow-400">schedule</span>
            </div>
            <p className="text-gray-400">Pending</p>
          </div>
          <p className="text-3xl font-bold text-white">0</p>
        </div>
        <div className="bg-surface-100 rounded-xl border border-surface-300 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-blue-500/20 rounded-lg">
              <span className="material-symbols-outlined text-blue-400">local_shipping</span>
            </div>
            <p className="text-gray-400">In Transit</p>
          </div>
          <p className="text-3xl font-bold text-white">0</p>
        </div>
        <div className="bg-surface-100 rounded-xl border border-surface-300 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-green-500/20 rounded-lg">
              <span className="material-symbols-outlined text-green-400">check_circle</span>
            </div>
            <p className="text-gray-400">Delivered</p>
          </div>
          <p className="text-3xl font-bold text-white">0</p>
        </div>
      </div>

      <div className="bg-surface-100 rounded-xl border border-surface-300 p-12 text-center">
        <span className="material-symbols-outlined text-6xl text-gray-600">local_shipping</span>
        <h3 className="text-xl font-semibold text-white mt-4">No shipments yet</h3>
        <p className="text-gray-400 mt-2">Shipment tracking will appear here when orders are shipped</p>
      </div>
    </div>
  )
}
