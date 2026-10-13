export default function EscrowSkeleton() {
  return (
    <div className="bg-white rounded-xl shadow-md p-6 animate-pulse">
      <div className="flex justify-between items-start mb-4">
        <div>
          <div className="h-6 w-24 bg-gray-200 rounded"></div>
          <div className="h-5 w-20 bg-gray-100 rounded-full mt-2"></div>
        </div>
        <div className="text-right">
          <div className="h-8 w-20 bg-gray-200 rounded"></div>
          <div className="h-3 w-12 bg-gray-100 rounded mt-1 ml-auto"></div>
        </div>
      </div>

      <div className="space-y-2 mb-4">
        <div className="h-4 w-full bg-gray-100 rounded"></div>
        <div className="h-4 w-3/4 bg-gray-100 rounded"></div>
        <div className="h-4 w-2/3 bg-gray-100 rounded"></div>
      </div>

      <div className="h-16 w-full bg-green-50 rounded mb-4"></div>
      <div className="h-10 w-32 bg-gray-200 rounded"></div>
    </div>
  );
}
