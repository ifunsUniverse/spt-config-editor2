import { Rnd } from "react-rnd";

export const BlueBox = () => {
  return (
    <Rnd
      default={{
        x: 100,
        y: 100,
        width: 300,
        height: 200,
      }}
      minWidth={100}
      minHeight={100}
      bounds="parent"
      className="z-50"
      style={{
        border: "2px solid rgba(59, 130, 246, 0.8)",
        background: "rgba(59, 130, 246, 0.1)",
        borderRadius: "4px",
      }}
      enableResizing={{
        top: true,
        right: true,
        bottom: true,
        left: true,
        topRight: true,
        bottomRight: true,
        bottomLeft: true,
        topLeft: true,
      }}
    >
      <div className="w-full h-full flex items-center justify-center pointer-events-none">
        <span className="text-xs text-blue-500 font-medium opacity-50">
          Drag & Resize
        </span>
      </div>
    </Rnd>
  );
};
