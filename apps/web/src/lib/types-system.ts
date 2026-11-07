export type SystemMachine = {
  vendor: string | null;
  model: string | null;
  version: string | null;
  board: string | null;
  label: string | null;
};

export type SystemCpuFrequency = {
  current_mhz: number | null;
  min_mhz: number | null;
  max_mhz: number | null;
  per_core_mhz: (number | null)[];
};

export type SystemCpu = {
  percent: number;
  per_core: number[];
  cores: number;
  threads: number;
  model: string | null;
  architecture: string | null;
  frequency: SystemCpuFrequency;
  times: {
    user: number;
    system: number;
    idle: number;
    iowait: number;
    nice: number;
    irq: number;
    steal: number;
  };
  load: { one: number; five: number; fifteen: number } | null;
  context: {
    ctx_switches?: number;
    interrupts?: number;
    soft_interrupts?: number;
  };
};

export type SystemMemory = {
  total_bytes: number;
  available_bytes: number;
  used_bytes: number;
  free_bytes: number;
  percent: number;
  cached_bytes: number;
  buffers_bytes: number;
  shared_bytes: number;
  active_bytes: number;
  inactive_bytes: number;
  reclaimable_bytes: number;
  swap_percent: number;
  swap: {
    total_bytes: number;
    used_bytes: number;
    free_bytes: number;
    percent: number;
    sin_bytes: number;
    sout_bytes: number;
  };
};

export type SystemDiskPartition = {
  device: string;
  mountpoint: string;
  fstype: string;
  options: string;
  physical: boolean;
  total_bytes: number;
  used_bytes: number;
  free_bytes: number;
  percent: number;
};

export type SystemDisk = {
  path: string;
  total_bytes: number;
  used_bytes: number;
  free_bytes: number;
  percent: number;
  partitions: SystemDiskPartition[];
};

export type SystemIo = {
  read_bytes: number;
  write_bytes: number;
  read_bytes_per_sec: number | null;
  write_bytes_per_sec: number | null;
  read_iops: number | null;
  write_iops: number | null;
};

export type SystemNetworkInterface = {
  name: string;
  bytes_sent: number;
  bytes_recv: number;
  packets_sent: number;
  packets_recv: number;
  errors_in: number;
  errors_out: number;
  drops_in: number;
  drops_out: number;
};

export type SystemNetwork = {
  bytes_sent: number;
  bytes_recv: number;
  recv_per_sec: number | null;
  sent_per_sec: number | null;
  interfaces: SystemNetworkInterface[];
};

export type SystemGpuDevice = {
  vendor: string;
  name: string;
  driver: string | null;
  utilization_percent: number | null;
  memory_used_bytes: number | null;
  memory_total_bytes: number | null;
  temperature_c: number | null;
  frequency_mhz: number | null;
  supported_metrics: string[];
  unavailable_metrics: string[];
};

export type SystemGpu = {
  devices: SystemGpuDevice[];
  available: boolean;
  live_metrics: boolean;
};

export type SystemThermalSensor = {
  id: string;
  source: string;
  label: string;
  temperature_c: number;
  critical_c: number | null;
};

export type SystemFan = {
  id: string;
  source: string;
  label: string;
  rpm: number;
};

export type SystemThermal = {
  sensors: SystemThermalSensor[];
  fans: SystemFan[];
  cpu_c: number | null;
  max_c: number | null;
  status: "normal" | "warning" | "critical" | "unavailable";
};

export type SystemBattery = {
  name: string;
  percent: number;
  status: string;
  plugged: boolean;
  power_w: number | null;
  voltage_v: number | null;
  energy_wh: number | null;
  capacity_wh: number | null;
  design_wh: number | null;
  health_percent: number | null;
  cycle_count: number | null;
  time_remaining_seconds: number | null;
};

export type SystemOverview = {
  timestamp: string;
  generated_at: string;
  uptime_seconds: number;
  platform: string;
  machine: SystemMachine;
  cpu: SystemCpu;
  memory: SystemMemory;
  disk: SystemDisk;
  disk_io: SystemIo;
  network: SystemNetwork;
  gpu: SystemGpu;
  thermal: SystemThermal;
  temperature_c: number | null;
  battery: SystemBattery | null;
  process_count: number;
  sampling_ms: number;
};

export type SystemHistoryPoint = {
  timestamp: string;
  cpu_percent: number;
  memory_percent: number;
  swap_percent: number;
  disk_percent: number;
  temperature_c: number | null;
  battery_percent: number | null;
  read_bytes_per_sec: number | null;
  write_bytes_per_sec: number | null;
  recv_bytes_per_sec: number | null;
  sent_bytes_per_sec: number | null;
  gpu_percent: number | null;
};

export type SystemHistory = {
  range: string;
  seconds: number;
  points: SystemHistoryPoint[];
  count: number;
  retention_seconds: number;
  generated_at: string;
};

export type ProcessInfo = {
  pid: number;
  ppid: number | null;
  name: string;
  username: string | null;
  cpu_percent: number;
  memory_bytes: number;
  memory_percent: number;
  status: string;
  created_at: string | null;
  runtime_seconds: number | null;
  threads: number | null;
  protected: boolean;
  can_terminate: boolean;
};

export type ProcessList = {
  processes: ProcessInfo[];
  total: number;
  limit: number;
  offset: number;
  generated_at: string;
};

export type ProcessDetail = ProcessInfo & {
  exe: string | null;
  cwd: string | null;
  cmdline: string[];
  cpu_times: { user_seconds: number; system_seconds: number } | null;
  memory_vms_bytes: number | null;
  fds: number | null;
  nice: number | null;
  io: {
    read_bytes: number;
    write_bytes: number;
    read_count: number;
    write_count: number;
  } | null;
  connections: {
    fd: number;
    status: string;
    family: string;
    type: string;
    laddr: string | null;
    raddr: string | null;
  }[];
  open_files: { path: string; fd: number }[];
  history: {
    timestamp: string;
    cpu_percent: number;
    memory_bytes: number;
  }[];
  notes: string[];
};
