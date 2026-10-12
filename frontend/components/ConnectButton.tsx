"use client";

import {
  useAppKit,
  useAppKitAccount,
  useDisconnect,
} from "@reown/appkit/react";
import { shortenAddress } from "@/lib/format";

export default function ConnectButton() {
  const { open } = useAppKit();
  const { address, isConnected } = useAppKitAccount();
  const { disconnect } = useDisconnect();

  if (isConnected && address) {
    return (
      <div className="flex items-center gap-3">
        <span className="text-sm text-black bg-gray-100 px-4 py-2 rounded-lg font-bold">
          {shortenAddress(address, 4)}
        </span>
        <button
          onClick={() => disconnect()}
          className="px-4 py-2 bg-black text-white text-sm rounded-lg hover:bg-black-600 transition font-medium"
        >
          Disconnect
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => open()}
      className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium"
    >
      Connect Wallet
    </button>
  );
}
