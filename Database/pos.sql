-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Host: 127.0.0.1
-- Generation Time: Mar 25, 2026 at 07:22 AM
-- Server version: 10.4.32-MariaDB
-- PHP Version: 8.2.12

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `pos`
--

-- --------------------------------------------------------

--
-- Table structure for table `inventory_transactions`
--

CREATE TABLE `inventory_transactions` (
  `id` varchar(36) NOT NULL DEFAULT uuid(),
  `product_id` varchar(36) NOT NULL,
  `transaction_type` enum('purchase','sale','return','adjustment') NOT NULL,
  `quantity` int(11) NOT NULL,
  `previous_stock` int(11) NOT NULL,
  `new_stock` int(11) NOT NULL,
  `reference_id` varchar(36) DEFAULT NULL,
  `notes` text DEFAULT NULL,
  `user_id` varchar(36) DEFAULT NULL,
  `createdAt` datetime(6) DEFAULT current_timestamp(6)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `products`
--

CREATE TABLE `products` (
  `id` varchar(36) NOT NULL DEFAULT uuid(),
  `sku` varchar(50) NOT NULL,
  `name` varchar(255) NOT NULL,
  `description` text DEFAULT NULL,
  `category` varchar(100) DEFAULT NULL,
  `price` decimal(10,2) NOT NULL,
  `cost_price` decimal(10,2) DEFAULT NULL,
  `stock_quantity` int(11) DEFAULT 0,
  `min_stock_level` int(11) DEFAULT 5,
  `barcode` varchar(100) DEFAULT NULL,
  `image_url` varchar(500) DEFAULT NULL,
  `is_active` tinyint(1) DEFAULT 1,
  `createdAt` datetime(6) DEFAULT current_timestamp(6),
  `updatedAt` datetime(6) DEFAULT current_timestamp(6) ON UPDATE current_timestamp(6)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `products`
--

INSERT INTO `products` (`id`, `sku`, `name`, `description`, `category`, `price`, `cost_price`, `stock_quantity`, `min_stock_level`, `barcode`, `image_url`, `is_active`, `createdAt`, `updatedAt`) VALUES
('90e9f0b9-280c-11f1-bc78-0a0027000011', 'PROD-001', 'Espresso', 'Strong Italian coffee', 'Beverages', 3.50, 1.20, 50, 5, '8901234567890', NULL, 1, '2026-03-25 13:34:43.229995', '2026-03-25 13:34:43.229995'),
('90ea036c-280c-11f1-bc78-0a0027000011', 'PROD-002', 'Cappuccino', 'Espresso with foamed milk', 'Beverages', 4.75, 1.80, 45, 5, '8901234567891', NULL, 1, '2026-03-25 13:34:43.229995', '2026-03-25 13:34:43.229995'),
('90ea0526-280c-11f1-bc78-0a0027000011', 'PROD-003', 'Latte', 'Espresso with steamed milk', 'Beverages', 4.50, 1.70, 38, 5, '8901234567892', NULL, 1, '2026-03-25 13:34:43.229995', '2026-03-25 13:34:43.229995'),
('90ea05d1-280c-11f1-bc78-0a0027000011', 'PROD-004', 'Americano', 'Espresso with hot water', 'Beverages', 3.25, 1.00, 42, 5, '8901234567893', NULL, 1, '2026-03-25 13:34:43.229995', '2026-03-25 13:34:43.229995'),
('90ea0660-280c-11f1-bc78-0a0027000011', 'PROD-005', 'Mocha', 'Chocolate flavored coffee', 'Beverages', 5.25, 2.00, 30, 5, '8901234567894', NULL, 1, '2026-03-25 13:34:43.229995', '2026-03-25 13:34:43.229995'),
('90ea06f3-280c-11f1-bc78-0a0027000011', 'PROD-006', 'Croissant', 'Butter croissant', 'Pastries', 2.95, 1.10, 25, 5, '8901234567895', NULL, 1, '2026-03-25 13:34:43.229995', '2026-03-25 13:34:43.229995'),
('90ea0782-280c-11f1-bc78-0a0027000011', 'PROD-007', 'Muffin', 'Blueberry muffin', 'Pastries', 3.25, 1.30, 28, 5, '8901234567896', NULL, 1, '2026-03-25 13:34:43.229995', '2026-03-25 13:34:43.229995'),
('90ea0811-280c-11f1-bc78-0a0027000011', 'PROD-008', 'Sandwich', 'Chicken sandwich', 'Food', 6.90, 3.50, 20, 5, '8901234567897', NULL, 1, '2026-03-25 13:34:43.229995', '2026-03-25 13:34:43.229995'),
('90ea08a0-280c-11f1-bc78-0a0027000011', 'PROD-009', 'Cheesecake', 'New York cheesecake', 'Desserts', 4.50, 2.20, 15, 5, '8901234567898', NULL, 1, '2026-03-25 13:34:43.229995', '2026-03-25 13:34:43.229995'),
('90ea091e-280c-11f1-bc78-0a0027000011', 'PROD-010', 'Brownie', 'Chocolate brownie', 'Desserts', 3.75, 1.50, 32, 5, '8901234567899', NULL, 1, '2026-03-25 13:34:43.229995', '2026-03-25 13:34:43.229995');

-- --------------------------------------------------------

--
-- Table structure for table `sales`
--

CREATE TABLE `sales` (
  `id` varchar(36) NOT NULL DEFAULT uuid(),
  `invoice_number` varchar(50) NOT NULL,
  `user_id` varchar(36) NOT NULL,
  `total_amount` decimal(10,2) NOT NULL,
  `tax_amount` decimal(10,2) DEFAULT 0.00,
  `discount_amount` decimal(10,2) DEFAULT 0.00,
  `payment_method` enum('cash','card','mobile','credit') NOT NULL,
  `payment_status` enum('pending','completed','refunded') DEFAULT 'completed',
  `customer_name` varchar(255) DEFAULT NULL,
  `customer_phone` varchar(20) DEFAULT NULL,
  `notes` text DEFAULT NULL,
  `createdAt` datetime(6) DEFAULT current_timestamp(6)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `sale_items`
--

CREATE TABLE `sale_items` (
  `id` varchar(36) NOT NULL DEFAULT uuid(),
  `sale_id` varchar(36) NOT NULL,
  `product_id` varchar(36) NOT NULL,
  `quantity` int(11) NOT NULL,
  `unit_price` decimal(10,2) NOT NULL,
  `subtotal` decimal(10,2) NOT NULL,
  `createdAt` datetime(6) DEFAULT current_timestamp(6)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `staff_attendance`
--

CREATE TABLE `staff_attendance` (
  `id` varchar(36) NOT NULL DEFAULT uuid(),
  `user_id` varchar(36) NOT NULL,
  `date` date NOT NULL,
  `check_in` time DEFAULT NULL,
  `check_out` time DEFAULT NULL,
  `status` enum('present','absent','late','half_day') DEFAULT 'present',
  `notes` text DEFAULT NULL,
  `createdAt` datetime(6) DEFAULT current_timestamp(6)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `users`
--

CREATE TABLE `users` (
  `id` varchar(36) NOT NULL,
  `email` varchar(255) NOT NULL,
  `phoneNumber` varchar(20) NOT NULL,
  `password` varchar(255) NOT NULL,
  `businessName` varchar(255) NOT NULL,
  `name` varchar(255) NOT NULL,
  `userType` enum('admin','staff') NOT NULL,
  `profilePic` varchar(500) DEFAULT NULL,
  `createdAt` datetime(6) NOT NULL DEFAULT current_timestamp(6),
  `updatedAt` datetime(6) NOT NULL DEFAULT current_timestamp(6) ON UPDATE current_timestamp(6)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `users`
--

INSERT INTO `users` (`id`, `email`, `phoneNumber`, `password`, `businessName`, `name`, `userType`, `profilePic`, `createdAt`, `updatedAt`) VALUES
('029b2117-a918-44e9-b8fd-c9681c60fbcc', 'parkwilfrem@gmail.com', '+639234234234', '$2b$10$mCqjZJeBBAta4brhoh7m9OdfGyxNqgXg7JPfl4RsvB1UBSimzkoFm', 'sdfsdfsdf', 'sasd', 'staff', NULL, '2026-03-25 12:04:35.852387', '2026-03-25 12:04:35.852387'),
('1ff7c314-14a3-4d54-bf9a-a49bb2440085', 'alis@gmail.com', '+639163194619', '$2b$10$wEeT02dOx4bTeSlhsvba9OpKgEyWduFw2KPrzvIy75yvf00CMKAti', 'sdfsdfsdf', 'fgfghgh', 'staff', NULL, '2026-03-25 11:22:25.283885', '2026-03-25 11:22:25.283885'),
('4ee3cb16-b84f-4c92-aeae-e0c8823c4f3e', 'andre@gmail.com', '+639238437423', '$2b$10$uPV8HNAoAydqdK7tYZGlB.B4B8W8VnU.5h3IY5ZBAGhRa3ndpkXY6', 'sdsad', 'andre', 'staff', NULL, '2026-03-23 16:11:41.184890', '2026-03-23 16:11:41.184890'),
('6f9231c1-7ef0-4106-80f5-a0747405599e', 'mike@gmail.com', '+639234773472', '$2b$10$ejFTe1U79YOP9tNSr4MevepggMGyFF1B0UPXtNsGYAHyaKyXOGbNm', 'farm', 'Mike', 'staff', NULL, '2026-03-23 16:08:26.796365', '2026-03-23 16:08:26.796365'),
('e9cce740-9f96-4dc2-9033-70d10df7c85a', 'wil@gmail.com', '+639564664623', '$2b$10$uS0EkESE8j38Lo.qTWnw3.mBR8XgeIn0JOGiK8da.sAWgc2bkm5aS', 'LL', 'wil', 'staff', NULL, '2026-03-25 14:13:44.307760', '2026-03-25 14:13:44.307760'),
('f3c982f7-5b65-4fbc-aae1-fbfee45c6dce', 'wilfremoscoso2@gmail.com', '+639163194698', '$2b$10$6wK3qaA4eOfIYSqFmH23FeiyxcOswsE0aI4d0BemsE0opCX9MNdp2', 'sdfsdfsdf', 'Wilfre Moscoso', 'staff', NULL, '2026-03-25 13:12:40.879456', '2026-03-25 13:12:40.879456');

--
-- Indexes for dumped tables
--

--
-- Indexes for table `inventory_transactions`
--
ALTER TABLE `inventory_transactions`
  ADD PRIMARY KEY (`id`),
  ADD KEY `product_id` (`product_id`),
  ADD KEY `user_id` (`user_id`);

--
-- Indexes for table `products`
--
ALTER TABLE `products`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `sku` (`sku`);

--
-- Indexes for table `sales`
--
ALTER TABLE `sales`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `invoice_number` (`invoice_number`),
  ADD KEY `user_id` (`user_id`);

--
-- Indexes for table `sale_items`
--
ALTER TABLE `sale_items`
  ADD PRIMARY KEY (`id`),
  ADD KEY `sale_id` (`sale_id`),
  ADD KEY `product_id` (`product_id`);

--
-- Indexes for table `staff_attendance`
--
ALTER TABLE `staff_attendance`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `unique_daily_attendance` (`user_id`,`date`);

--
-- Indexes for table `users`
--
ALTER TABLE `users`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `IDX_97672ac88f789774dd47f7c8be` (`email`),
  ADD UNIQUE KEY `IDX_1e3d0240b49c40521aaeb95329` (`phoneNumber`);

--
-- Constraints for dumped tables
--

--
-- Constraints for table `inventory_transactions`
--
ALTER TABLE `inventory_transactions`
  ADD CONSTRAINT `inventory_transactions_ibfk_1` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`),
  ADD CONSTRAINT `inventory_transactions_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`);

--
-- Constraints for table `sales`
--
ALTER TABLE `sales`
  ADD CONSTRAINT `sales_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`);

--
-- Constraints for table `sale_items`
--
ALTER TABLE `sale_items`
  ADD CONSTRAINT `sale_items_ibfk_1` FOREIGN KEY (`sale_id`) REFERENCES `sales` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `sale_items_ibfk_2` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`);

--
-- Constraints for table `staff_attendance`
--
ALTER TABLE `staff_attendance`
  ADD CONSTRAINT `staff_attendance_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`);
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
