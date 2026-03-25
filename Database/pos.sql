-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Host: 127.0.0.1
-- Generation Time: Mar 25, 2026 at 04:09 AM
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
('4ee3cb16-b84f-4c92-aeae-e0c8823c4f3e', 'andre@gmail.com', '+639238437423', '$2b$10$uPV8HNAoAydqdK7tYZGlB.B4B8W8VnU.5h3IY5ZBAGhRa3ndpkXY6', 'sdsad', 'andre', 'staff', NULL, '2026-03-23 16:11:41.184890', '2026-03-23 16:11:41.184890'),
('6f9231c1-7ef0-4106-80f5-a0747405599e', 'mike@gmail.com', '+639234773472', '$2b$10$ejFTe1U79YOP9tNSr4MevepggMGyFF1B0UPXtNsGYAHyaKyXOGbNm', 'farm', 'Mike', 'staff', NULL, '2026-03-23 16:08:26.796365', '2026-03-23 16:08:26.796365');

--
-- Indexes for dumped tables
--

--
-- Indexes for table `users`
--
ALTER TABLE `users`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `IDX_97672ac88f789774dd47f7c8be` (`email`),
  ADD UNIQUE KEY `IDX_1e3d0240b49c40521aaeb95329` (`phoneNumber`);
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
