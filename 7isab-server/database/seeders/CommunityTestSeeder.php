<?php

namespace Database\Seeders;

use App\Models\User;
use App\Modules\Community\Models\CommunityProfile;
use App\Modules\Community\Models\Post;
use App\Modules\Community\Models\ProgramTemplate;
use App\Modules\Community\Models\Space;
use App\Modules\Community\Models\SpaceMember;
use App\Modules\Community\Models\TestamentTemplate;
use App\Modules\Community\Services\RuleBook;
use Illuminate\Database\Seeder;

/**
 * Local-only sample data for trying the community feed and imports on a device.
 * Never runs outside the local environment (tests and production skip it).
 */
class CommunityTestSeeder extends Seeder
{
    public function run(): void
    {
        if (! app()->environment('local')) {
            return;
        }

        $user = User::where('email', 'test@example.com')->first();

        if (! $user) {
            $this->command?->warn('CommunityTestSeeder: sign up in the app as test@example.com first, then seed again.');

            return;
        }

        $profile = CommunityProfile::firstOrCreate(
            ['user_id' => $user->id],
            [
                'first_name' => 'Test',
                'last_name' => 'User',
                'gender' => 'male',
                'status' => 'active',
                'joined_at' => now(),
            ],
        );

        $rules = app(RuleBook::class);
        $rules->accept($profile, $rules->current());

        $space = Space::firstOrCreate(
            ['slug' => 'test-space'],
            [
                'type' => 'group',
                'name' => 'Test Space',
                'purpose' => 'Testing community posts',
                'goals' => 'Verify testament and program imports',
                'content_plan' => 'Test posts with payloads',
                'owner_id' => $profile->id,
                'gender' => $profile->gender,
                'join_policy' => 'open',
                'status' => 'active',
            ],
        );

        SpaceMember::firstOrCreate(
            ['space_id' => $space->id, 'profile_id' => $profile->id],
            ['role' => 'owner', 'status' => 'active'],
        );

        if (Post::where('space_id', $space->id)->exists()) {
            $this->command?->info('CommunityTestSeeder: sample posts already exist.');

            return;
        }

        $testament = [
            'category' => 'akhira',
            'text' => 'Prepare for the Akhira as if you will meet Allah tomorrow.',
            'source' => 'Sample',
        ];
        $testamentTemplate = TestamentTemplate::create(['author_id' => $profile->id, ...$testament]);

        Post::create([
            'space_id' => $space->id,
            'author_id' => $profile->id,
            'type' => 'testament',
            'body' => 'A Testament to import',
            'payload' => [...$testament, 'template_id' => $testamentTemplate->id],
            'audience' => 'everyone',
            'status' => 'published',
        ]);

        $program = [
            'name' => 'Sample program',
            'category' => 'improving',
            'goal' => 'A daily habit for 30 days',
            'length' => 30,
            'tasks' => [
                ['name' => 'Read one page of Quran', 'type' => 'custom', 'reward' => 1],
                ['name' => 'Morning athkar', 'type' => 'custom', 'reward' => 1],
            ],
        ];
        $programTemplate = ProgramTemplate::create(['author_id' => $profile->id, ...$program]);

        Post::create([
            'space_id' => $space->id,
            'author_id' => $profile->id,
            'type' => 'program',
            'body' => 'A program to import',
            'payload' => [...$program, 'template_id' => $programTemplate->id],
            'audience' => 'everyone',
            'status' => 'published',
        ]);

        $this->command?->info("CommunityTestSeeder: space {$space->id} with a Testament and a program post.");
    }
}
