<?php

namespace Database\Factories;

use App\Enums\Role;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

/**
 * @extends Factory<User>
 */
class UserFactory extends Factory
{
    protected static ?string $password;

    /**
     * An app user with key-derivation parameters (holds encrypted data).
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'name' => fake()->name(),
            'email' => fake()->unique()->safeEmail(),
            'password' => static::$password ??= Hash::make('password'),
            'kdf' => [
                'algorithm' => 'scrypt',
                'salt' => base64_encode(random_bytes(16)),
                'params' => ['N' => 32768, 'r' => 8, 'p' => 1],
            ],
            'is_active' => true,
            'remember_token' => Str::random(10),
        ];
    }

    public function inactive(): static
    {
        return $this->state(fn (array $attributes) => ['is_active' => false]);
    }

    /** A panel-only account: no encrypted data, so no key-derivation parameters. */
    public function admin(Role $role = Role::Admin): static
    {
        return $this->state(fn (array $attributes) => ['kdf' => null])
            ->afterCreating(fn (User $user) => $user->assignRole($role->value));
    }

    public function superAdmin(): static
    {
        return $this->admin(Role::SuperAdmin);
    }
}
